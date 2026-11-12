"use server";

import { revalidatePath } from "next/cache";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbDelete, sbFetch, sbGet, sbInsert, sbPatch } from "@/lib/supabase";
import { allow, TOO_MANY } from "@/lib/rateLimit";
import { askForJson, aiConfigured, AI_MODEL } from "@/lib/ai";
import { STT_MODEL, sttConfigured, transcribe } from "@/lib/stt";
import { PLAN_KIND_LABEL, canEditPlan } from "@/lib/plans";

type Result = { ok: boolean; message: string };
const fail = (e: unknown): Result => ({ ok: false, message: e instanceof Error ? e.message : "處理失敗，請再試一次" });
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// AI 整理的結果（先給老師看，按「套用」才寫進規劃的決議與待辦）
export type MeetingAi = {
  summary: string;
  agenda_results?: { index: number; conclusion: string }[];
  decisions: string[];
  tasks: { title: string; assignee: string; due: string }[];
  open_questions: string[];
};

type M = { id: string; plan_id: string | null; title: string; created_by: string | null; parts_total: number; status: string };
async function loadMeeting(id: string) {
  if (!isUuid(id)) throw new Error("資料不正確");
  const m = (await sbGet<M[]>(`meetings?id=eq.${id}&select=id,plan_id,title,created_by,parts_total,status`))[0];
  if (!m) throw new Error("找不到這場會議，可能已被刪除");
  return m;
}
const refresh = (m: { plan_id: string | null }) => {
  if (m.plan_id) revalidatePath(`/admin/plans/${m.plan_id}`);
  revalidatePath("/admin/meetings/[id]", "page");
};
const today = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

// 這份規劃的下一次會議編號（0019 的 seq；還沒執行 0019 時用會議數量推算）
async function nextSeq(planId: string): Promise<{ seq: number; hasSeq: boolean }> {
  const rows = await sbGet<{ seq: number | null }[]>(`meetings?plan_id=eq.${planId}&select=seq&order=seq.desc.nullslast&limit=1`).catch(() => null);
  if (rows) {
    const all = await sbGet<{ id: string }[]>(`meetings?plan_id=eq.${planId}&select=id`);
    return { seq: Math.max(rows[0]?.seq ?? 0, all.length) + 1, hasSeq: true };
  }
  const all = await sbGet<{ id: string }[]>(`meetings?plan_id=eq.${planId}&select=id`);
  return { seq: all.length + 1, hasSeq: false };
}
const seqTitle = (n: number) => `第 ${n} 次會議`;

// 1. 建立會議（錄音已在瀏覽器切好段，告訴伺服器總共幾段）
export async function createMeeting(input: {
  planId: string; title: string; heldOn: string; partsTotal: number; durationSec: number; consent: boolean;
}): Promise<Result & { id?: string }> {
  try {
    const staff = await requireStaff();
    if (!sttConfigured()) return { ok: false, message: "還沒設定語音轉文字的金鑰，請管理員到 Vercel 設定 OPENAI_API_KEY" };
    if (!input.consent) return { ok: false, message: "請先確認已告知與會老師要錄音" };
    if (!isUuid(input.planId)) return { ok: false, message: "資料不正確" };
    const p = await sbGet<{ id: string }[]>(`plans?id=eq.${input.planId}&select=id`);
    if (!p[0]) return { ok: false, message: "找不到這份規劃" };
    const parts = Math.floor(input.partsTotal);
    if (!(parts >= 1 && parts <= 400)) return { ok: false, message: "錄音太長（最多約 10 小時）" };
    const n = await nextSeq(input.planId);
    const title = String(input.title ?? "").trim().slice(0, 80) || seqTitle(n.seq);
    const m = await sbInsert<{ id: string }>("meetings", {
      ...(n.hasSeq ? { seq: n.seq } : {}),
      plan_id: input.planId, title, held_on: isDate(input.heldOn) ? input.heldOn : today(),
      parts_total: parts, duration_sec: Math.round(input.durationSec) || null, status: "transcribing",
      consent_note: `已告知與會者（${staff.name} 確認）`, created_by: staff.id,
    });
    await audit(actorOf(staff), "meeting.create", `meetings:${m.id}`, { plan: input.planId, parts });
    revalidatePath(`/admin/plans/${input.planId}`);
    return { ok: true, message: "已建立", id: m.id };
  } catch (e) {
    return fail(e);
  }
}

// 0. 先安排會議（還沒錄音）：可以先擬議程；所有老師都可以安排
export async function planMeeting(input: { planId: string; title?: string; heldOn?: string }): Promise<Result & { id?: string }> {
  try {
    const staff = await requireStaff();
    if (!isUuid(input.planId)) return { ok: false, message: "資料不正確" };
    const p = await sbGet<{ id: string }[]>(`plans?id=eq.${input.planId}&select=id`);
    if (!p[0]) return { ok: false, message: "找不到這份規劃" };
    const heldOn = isDate(input.heldOn) ? input.heldOn : today();
    const n = await nextSeq(input.planId);
    const title = String(input.title ?? "").trim().slice(0, 80) || seqTitle(n.seq);
    const m = await sbInsert<{ id: string }>("meetings", {
      ...(n.hasSeq ? { seq: n.seq } : {}),
      plan_id: input.planId, title, held_on: heldOn, status: "planned", parts_total: 0, created_by: staff.id,
    });
    await audit(actorOf(staff), "meeting.plan", `meetings:${m.id}`, { plan: input.planId });
    revalidatePath(`/admin/plans/${input.planId}`);
    return { ok: true, message: `已安排${title}，可以開始擬議程`, id: m.id };
  } catch (e) {
    return fail(e);
  }
}

// 已安排的會議開完後，把錄音接上去
export async function attachRecording(input: { meetingId: string; partsTotal: number; durationSec: number; consent: boolean }): Promise<Result> {
  try {
    const staff = await requireStaff();
    if (!sttConfigured()) return { ok: false, message: "還沒設定語音轉文字的金鑰，請管理員到 Vercel 設定 OPENAI_API_KEY" };
    if (!input.consent) return { ok: false, message: "請先確認已告知與會老師要錄音" };
    const m = await loadMeeting(input.meetingId);
    if (m.status !== "planned") return { ok: false, message: "這場會議已經匯入過錄音" };
    const parts = Math.floor(input.partsTotal);
    if (!(parts >= 1 && parts <= 400)) return { ok: false, message: "錄音太長（最多約 10 小時）" };
    await sbPatch(`meetings?id=eq.${m.id}&status=eq.planned`, {
      status: "transcribing", parts_total: parts, duration_sec: Math.round(input.durationSec) || null,
      consent_note: `已告知與會者（${staff.name} 確認）`, updated_at: new Date().toISOString(),
    });
    await audit(actorOf(staff), "meeting.attach_audio", `meetings:${m.id}`, { parts });
    return { ok: true, message: "ok" };
  } catch (e) {
    return fail(e);
  }
}

// ---------- 議程 ----------
// 所有老師都能新增議題；修改、刪除、排序：新增的人、該議題負責人、會議安排人、規劃負責人或管理員
type AgendaRow = { id: string; meeting_id: string; seq: number; owner_id: string | null; created_by: string | null };
async function agendaCtx(id: string) {
  if (!isUuid(id)) throw new Error("資料不正確");
  const a = (await sbGet<AgendaRow[]>(`meeting_agenda?id=eq.${id}&select=id,meeting_id,seq,owner_id,created_by`))[0];
  if (!a) throw new Error("找不到這個議題，可能已被刪除");
  const m = await loadMeeting(a.meeting_id);
  return { a, m };
}
async function canTouchAgenda(a: AgendaRow, m: M, staff: { id: string; is_admin: boolean }) {
  if (staff.is_admin || a.created_by === staff.id || a.owner_id === staff.id || m.created_by === staff.id) return true;
  if (!m.plan_id) return false;
  const plan = (await sbGet<{ owner_id: string | null; created_by: string | null }[]>(`plans?id=eq.${m.plan_id}&select=owner_id,created_by`))[0];
  return !!plan && canEditPlan(plan, staff);
}
const agendaFields = async (input: { title: string; ownerId: string; minutes: string | number; notes: string }) => {
  const title = String(input.title ?? "").trim().slice(0, 200);
  if (!title) throw new Error("請填寫議題");
  let ownerId: string | null = null;
  if (input.ownerId) {
    if (!isUuid(input.ownerId)) throw new Error("老師資料不正確");
    const t = await sbGet<{ id: string }[]>(`teachers?id=eq.${input.ownerId}&active=eq.true&select=id`);
    if (!t[0]) throw new Error("找不到這位老師");
    ownerId = input.ownerId;
  }
  const n = Number(input.minutes);
  return {
    title, owner_id: ownerId, minutes: Number.isInteger(n) && n >= 1 && n <= 240 ? n : null,
    notes: String(input.notes ?? "").trim().slice(0, 2000) || null,
  };
};

export async function addAgenda(input: { meetingId: string; title: string; ownerId: string; minutes: string | number; notes: string }): Promise<Result> {
  try {
    const staff = await requireStaff();
    const m = await loadMeeting(input.meetingId);
    const f = await agendaFields(input);
    const last = await sbGet<{ seq: number }[]>(`meeting_agenda?meeting_id=eq.${m.id}&select=seq&order=seq.desc&limit=1`);
    const a = await sbInsert<{ id: string }>("meeting_agenda", { ...f, meeting_id: m.id, seq: (last[0]?.seq ?? 0) + 10, created_by: staff.id });
    await audit(actorOf(staff), "meeting.agenda_add", `meeting_agenda:${a.id}`, { meeting: m.id });
    refresh(m);
    return { ok: true, message: "已加入議程" };
  } catch (e) {
    return fail(e);
  }
}

export async function updateAgenda(input: { id: string; title: string; ownerId: string; minutes: string | number; notes: string; result?: string }): Promise<Result> {
  try {
    const staff = await requireStaff();
    const { a, m } = await agendaCtx(input.id);
    if (!(await canTouchAgenda(a, m, staff))) return { ok: false, message: "只有新增的人、議題負責人、會議安排人或規劃負責人可以修改" };
    const f = await agendaFields(input);
    const patch: Record<string, unknown> = { ...f, updated_at: new Date().toISOString() };
    if (input.result !== undefined) patch.result = String(input.result).trim().slice(0, 2000) || null;
    await sbPatch(`meeting_agenda?id=eq.${a.id}`, patch);
    await audit(actorOf(staff), "meeting.agenda_edit", `meeting_agenda:${a.id}`, {});
    refresh(m);
    return { ok: true, message: "已儲存" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAgenda(id: string): Promise<Result> {
  try {
    const staff = await requireStaff();
    const { a, m } = await agendaCtx(id);
    if (!(await canTouchAgenda(a, m, staff))) return { ok: false, message: "只有新增的人、議題負責人、會議安排人或規劃負責人可以刪除" };
    await sbDelete(`meeting_agenda?id=eq.${a.id}`);
    await audit(actorOf(staff), "meeting.agenda_delete", `meeting_agenda:${a.id}`, {});
    refresh(m);
    return { ok: true, message: "已刪除" };
  } catch (e) {
    return fail(e);
  }
}

// 上下移動：和相鄰的議題交換順序
export async function moveAgenda(id: string, dir: -1 | 1): Promise<Result> {
  try {
    const staff = await requireStaff();
    const { a, m } = await agendaCtx(id);
    if (!(await canTouchAgenda(a, m, staff))) return { ok: false, message: "沒有權限調整順序" };
    const all = await sbGet<{ id: string; seq: number }[]>(`meeting_agenda?meeting_id=eq.${m.id}&select=id,seq&order=seq,created_at`);
    const i = all.findIndex((x) => x.id === a.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= all.length) return { ok: true, message: "" };
    // 重新編號，避免 seq 重複
    const order = all.map((x) => x.id);
    [order[i], order[j]] = [order[j], order[i]];
    for (let k = 0; k < order.length; k++) {
      if (all.find((x) => x.id === order[k])!.seq !== (k + 1) * 10) await sbPatch(`meeting_agenda?id=eq.${order[k]}`, { seq: (k + 1) * 10 });
    }
    refresh(m);
    return { ok: true, message: "" };
  } catch (e) {
    return fail(e);
  }
}

// 哪幾段已經轉好（中斷後「繼續」時只送缺的）
export async function meetingProgress(id: string): Promise<{ ok: boolean; done: number[]; total: number; message?: string }> {
  try {
    await requireStaff();
    const m = await loadMeeting(id);
    const parts = await sbGet<{ idx: number }[]>(`meeting_parts?meeting_id=eq.${id}&select=idx`);
    return { ok: true, done: parts.map((p) => p.idx), total: m.parts_total };
  } catch (e) {
    return { ok: false, done: [], total: 0, message: fail(e).message };
  }
}

// 2. 一段錄音轉文字（錄音檔不保存，只存文字）
export async function transcribePart(fd: FormData): Promise<Result> {
  try {
    const staff = await requireStaff();
    const id = String(fd.get("meetingId") ?? "");
    const idx = Number(fd.get("idx"));
    const file = fd.get("audio");
    const m = await loadMeeting(id);
    if (!(Number.isInteger(idx) && idx >= 0 && idx < m.parts_total)) return { ok: false, message: "段落編號不正確" };
    if (!(file instanceof Blob) || file.size === 0 || file.size > 4 * 1024 * 1024) return { ok: false, message: "這一段錄音的大小不正確" };
    if (!(await allow("stt", staff.id))) return { ok: false, message: `語音轉文字${TOO_MANY}` };
    // 上一段的結尾當提示，讓接段比較順
    const prev = idx > 0 ? (await sbGet<{ text: string }[]>(`meeting_parts?meeting_id=eq.${id}&idx=eq.${idx - 1}&select=text`))[0]?.text ?? "" : "";
    const text = await transcribe(file, prev);
    const res = await sbFetch("meeting_parts?on_conflict=meeting_id,idx", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ meeting_id: id, idx, text }),
    });
    if (!res.ok) throw new Error("儲存逐字稿失敗");
    return { ok: true, message: "ok" };
  } catch (e) {
    return fail(e);
  }
}

const SYSTEM = `你是「玩學院 Play Collegeee」（台中的兒童 STEAM 教室）的行政助理，負責整理老師們的課程規劃會議紀錄。
規則：
- 一律使用繁體中文、台灣用語，條列清楚、具體。
- 逐字稿是語音辨識的結果，可能有錯字或同音字，請依上下文判斷，不要照抄錯字。
- 只整理會議裡真的有講到的內容，不要自己編造決議或待辦。
- 決議：大家已經同意、確定要做的事。還在討論、沒有結論的放到「待討論事項」。
- 待辦：有人要去做的事；負責人請從提供的老師名單裡挑（會議中有提到才填，沒提到就留空）；期限只有會議中有明確日期才填（YYYY-MM-DD），否則留空。
- 不要寫孩子的全名或個資；提到學生時用「某位學生」。`;

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "會議摘要，3–8 點，每點一行，用「• 」開頭" },
    decisions: { type: "array", items: { type: "string" }, description: "決議事項，每項一句" },
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "要做的事" },
          assignee: { type: "string", description: "負責老師（從名單挑，沒提到留空）" },
          due: { type: "string", description: "期限 YYYY-MM-DD，沒提到留空" },
        },
        required: ["title", "assignee", "due"],
        additionalProperties: false,
      },
    },
    open_questions: { type: "array", items: { type: "string" }, description: "還沒有結論、下次要再討論的事" },
    agenda_results: {
      type: "array",
      description: "依議程編號逐項的結論（沒有議程就回空陣列）",
      items: {
        type: "object",
        properties: { index: { type: "integer", description: "議程編號（從 1 開始）" }, conclusion: { type: "string", description: "這一項的結論，1–3 句" } },
        required: ["index", "conclusion"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "decisions", "tasks", "open_questions", "agenda_results"],
  additionalProperties: false,
};

// 3. 全部轉好後，請 AI 整理摘要、決議、待辦
export async function summarizeMeeting(id: string): Promise<Result> {
  try {
    const staff = await requireStaff();
    const m = await loadMeeting(id);
    if (!aiConfigured()) return { ok: false, message: "還沒設定 AI 金鑰（ANTHROPIC_API_KEY）" };
    const parts = await sbGet<{ idx: number; text: string }[]>(`meeting_parts?meeting_id=eq.${id}&select=idx,text&order=idx`);
    if (parts.length < m.parts_total) return { ok: false, message: `還有 ${m.parts_total - parts.length} 段沒轉成文字，請按「繼續」` };
    if (!(await allow("ai", staff.id))) return { ok: false, message: `AI ${TOO_MANY}` };
    const transcript = parts.map((p) => p.text).join("\n").trim();
    if (transcript.length < 10) {
      await sbPatch(`meetings?id=eq.${id}`, { status: "failed", updated_at: new Date().toISOString() });
      return { ok: false, message: "錄音裡幾乎沒有辨識到說話內容，請確認錄音檔" };
    }
    await sbPatch(`meetings?id=eq.${id}`, { status: "summarizing", updated_at: new Date().toISOString() });
    const [teachers, plan] = await Promise.all([
      sbGet<{ name: string; nickname: string | null }[]>("teachers?active=eq.true&select=name,nickname"),
      m.plan_id ? sbGet<{ kind: string; title: string; theme: string | null; start_date: string | null }[]>(`plans?id=eq.${m.plan_id}&select=kind,title,theme,start_date`) : Promise.resolve([]),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    // 有事先擬議程的話，請 AI 依議程逐項整理結論
    const agenda = await sbGet<{ id: string; title: string }[]>(`meeting_agenda?meeting_id=eq.${id}&select=id,title&order=seq,created_at`).catch(() => []);
    const raw = await askForJson<MeetingAi>({
      system: SYSTEM,
      content: [{
        type: "text",
        text: `會議：${m.title}（今天 ${today}）
${agenda.length ? `這次會議的議程（請在 agenda_results 依編號寫出每一項的結論；沒有討論到的寫「未討論」）：\n${agenda.map((a, i) => `${i + 1}. ${a.title}`).join("\n")}\n` : ""}${plan[0] ? `討論的規劃：${PLAN_KIND_LABEL[plan[0].kind]}「${plan[0].title}${plan[0].theme ? `・${plan[0].theme}` : "（主題討論中）"}」${plan[0].start_date ? `，${plan[0].start_date} 開始` : ""}\n` : ""}老師名單：${teachers.map((t) => (t.nickname ? `${t.nickname}（${t.name}）` : t.name)).join("、")}

逐字稿：
${transcript.slice(0, 60000)}

請直接呼叫 meeting_notes 工具回傳整理結果，不要另外寫文字。`,
      }],
      toolName: "meeting_notes",
      toolDescription: "回傳會議摘要、決議、待辦、待討論事項",
      schema: SCHEMA,
      maxTokens: 4000,
    });
    const clean = (a: unknown, n: number) => (Array.isArray(a) ? a.map((x) => String(x ?? "").trim().slice(0, 500)).filter(Boolean).slice(0, n) : []);
    const ai: MeetingAi = {
      summary: String(raw.summary ?? "").trim().slice(0, 4000),
      decisions: clean(raw.decisions, 30),
      tasks: (Array.isArray(raw.tasks) ? raw.tasks : []).slice(0, 30).map((t) => ({
        title: String(t?.title ?? "").trim().slice(0, 300), assignee: String(t?.assignee ?? "").trim().slice(0, 40),
        due: isDate(t?.due) ? t.due : "",
      })).filter((t) => t.title),
      open_questions: clean(raw.open_questions, 30),
      agenda_results: (Array.isArray(raw.agenda_results) ? raw.agenda_results : [])
        .map((r) => ({ index: Number(r?.index), conclusion: String(r?.conclusion ?? "").trim().slice(0, 1000) }))
        .filter((r) => Number.isInteger(r.index) && r.index >= 1 && r.index <= agenda.length && r.conclusion),
    };
    // 把每一項的結論寫回議程（老師之後可以修改）
    for (const r of ai.agenda_results ?? []) {
      await sbPatch(`meeting_agenda?id=eq.${agenda[r.index - 1].id}`, { result: r.conclusion, updated_at: new Date().toISOString() });
    }
    await sbPatch(`meetings?id=eq.${id}`, { status: "ready", summary: ai.summary, ai_result: ai, updated_at: new Date().toISOString() });
    await audit(actorOf(staff), "meeting.summarize", `meetings:${id}`, { model: AI_MODEL, stt: STT_MODEL, chars: transcript.length });
    refresh(m);
    return { ok: true, message: "整理完成" };
  } catch (e) {
    try { await sbPatch(`meetings?id=eq.${id}&status=eq.summarizing`, { status: "transcribing" }); } catch {}
    return fail(e);
  }
}

// 修改摘要（建立者、規劃負責人、管理員）
export async function saveMeetingSummary(id: string, summary: string): Promise<Result> {
  try {
    const staff = await requireStaff();
    const m = await loadMeeting(id);
    const plan = m.plan_id ? (await sbGet<{ owner_id: string | null; created_by: string | null }[]>(`plans?id=eq.${m.plan_id}&select=owner_id,created_by`))[0] : null;
    if (!(m.created_by === staff.id || (plan && canEditPlan(plan, staff)))) return { ok: false, message: "只有匯入的老師或規劃負責人可以修改摘要" };
    await sbPatch(`meetings?id=eq.${id}`, { summary: summary.trim().slice(0, 4000), updated_at: new Date().toISOString() });
    await audit(actorOf(staff), "meeting.summary_edit", `meetings:${id}`, {});
    refresh(m);
    return { ok: true, message: "已儲存" };
  } catch (e) {
    return fail(e);
  }
}

// 4. 把老師勾選的決議、待辦寫進規劃
export async function applyMeeting(input: {
  id: string; decisions: string[]; tasks: { title: string; assigneeId: string; due: string }[];
}): Promise<Result> {
  try {
    const staff = await requireStaff();
    const m = await loadMeeting(input.id);
    if (!m.plan_id) return { ok: false, message: "這場會議沒有對應的規劃" };
    const plan = (await sbGet<{ owner_id: string | null; created_by: string | null }[]>(`plans?id=eq.${m.plan_id}&select=owner_id,created_by`))[0];
    if (!plan) return { ok: false, message: "找不到這份規劃" };
    const decisions = (input.decisions ?? []).map((d) => String(d).trim().slice(0, 2900)).filter(Boolean).slice(0, 30);
    if (decisions.length && !canEditPlan(plan, staff)) return { ok: false, message: "決議只有規劃的負責老師、建立者或管理員可以套用（待辦可以）" };
    const teacherIds = new Set((await sbGet<{ id: string }[]>("teachers?active=eq.true&select=id")).map((t) => t.id));
    const now = new Date().toISOString();
    if (decisions.length) {
      const r = await sbFetch("plan_comments", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify(decisions.map((d) => ({
          plan_id: m.plan_id, body: `〔${m.title}〕${d}`, author_id: staff.id, is_decision: true, decided_by: staff.id, decided_at: now,
          meeting_id: m.id,
        }))),
      });
      if (!r.ok) throw new Error("寫入決議失敗");
    }
    const tasks = (input.tasks ?? []).map((t) => ({
      plan_id: m.plan_id, title: String(t.title ?? "").trim().slice(0, 300),
      assignee_id: teacherIds.has(t.assigneeId) ? t.assigneeId : null, due_date: isDate(t.due) ? t.due : null, created_by: staff.id,
      meeting_id: m.id,
    })).filter((t) => t.title).slice(0, 30);
    if (tasks.length) {
      const r = await sbFetch("plan_tasks", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(tasks) });
      if (!r.ok) throw new Error("寫入待辦失敗");
    }
    await sbPatch(`meetings?id=eq.${m.id}`, { applied_at: now, updated_at: now });
    await audit(actorOf(staff), "meeting.apply", `meetings:${m.id}`, { decisions: decisions.length, tasks: tasks.length });
    refresh(m);
    revalidatePath("/admin");
    return { ok: true, message: `已加入 ${decisions.length} 項決議、${tasks.length} 項待辦` };
  } catch (e) {
    return fail(e);
  }
}

// 會議室：修改會議名稱與日期（會議建立者、小幫手、規劃負責人、管理員）
export async function updateMeeting(input: { id: string; title: string; heldOn: string }): Promise<Result> {
  try {
    const staff = await requireStaff();
    const m = await loadMeeting(input.id);
    const plan = m.plan_id ? (await sbGet<{ owner_id: string | null; created_by: string | null }[]>(`plans?id=eq.${m.plan_id}&select=owner_id,created_by`))[0] : null;
    const helpers = await sbGet<{ teacher_id: string }[]>(`meeting_helpers?meeting_id=eq.${m.id}&select=teacher_id`).catch(() => []);
    if (!(staff.is_admin || m.created_by === staff.id || helpers.some((h) => h.teacher_id === staff.id) || (plan && canEditPlan(plan, staff)))) {
      return { ok: false, message: "只有會議建立者、小幫手老師、規劃負責人或管理員可以修改" };
    }
    const title = String(input.title ?? "").trim().slice(0, 80);
    if (!title) return { ok: false, message: "請填寫會議名稱" };
    await sbPatch(`meetings?id=eq.${m.id}`, { title, held_on: isDate(input.heldOn) ? input.heldOn : null, updated_at: new Date().toISOString() });
    await audit(actorOf(staff), "meeting.update", `meetings:${m.id}`, {});
    refresh(m);
    return { ok: true, message: "已儲存" };
  } catch (e) {
    return fail(e);
  }
}

// 刪除會議紀錄（含逐字稿）：匯入的老師或管理員
export async function deleteMeeting(id: string): Promise<Result> {
  try {
    const staff = await requireStaff();
    const m = await loadMeeting(id);
    if (!(staff.is_admin || m.created_by === staff.id)) return { ok: false, message: "只有匯入的老師或管理員可以刪除" };
    await sbDelete(`meetings?id=eq.${id}`);
    await audit(actorOf(staff), "meeting.delete", `meetings:${id}`, {});
    refresh(m);
    return { ok: true, message: "已刪除" };
  } catch (e) {
    return fail(e);
  }
}

// 讀逐字稿（展開時才載入，避免規劃頁太重）
export async function getTranscript(id: string): Promise<{ ok: boolean; text: string; message?: string }> {
  try {
    await requireStaff();
    await loadMeeting(id);
    const parts = await sbGet<{ text: string }[]>(`meeting_parts?meeting_id=eq.${id}&select=text&order=idx`);
    return { ok: true, text: parts.map((p) => p.text).join("\n") };
  } catch (e) {
    return { ok: false, text: "", message: fail(e).message };
  }
}


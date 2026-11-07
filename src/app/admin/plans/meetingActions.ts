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
const refresh = (m: { plan_id: string | null }) => { if (m.plan_id) revalidatePath(`/admin/plans/${m.plan_id}`); };

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
    const title = String(input.title ?? "").trim().slice(0, 80) || "會議紀錄";
    const m = await sbInsert<{ id: string }>("meetings", {
      plan_id: input.planId, title, held_on: isDate(input.heldOn) ? input.heldOn : null,
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
  },
  required: ["summary", "decisions", "tasks", "open_questions"],
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
    const raw = await askForJson<MeetingAi>({
      system: SYSTEM,
      content: [{
        type: "text",
        text: `會議：${m.title}（今天 ${today}）
${plan[0] ? `討論的規劃：${PLAN_KIND_LABEL[plan[0].kind]}「${plan[0].title}${plan[0].theme ? `・${plan[0].theme}` : "（主題討論中）"}」${plan[0].start_date ? `，${plan[0].start_date} 開始` : ""}\n` : ""}老師名單：${teachers.map((t) => (t.nickname ? `${t.nickname}（${t.name}）` : t.name)).join("、")}

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
    };
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
        }))),
      });
      if (!r.ok) throw new Error("寫入決議失敗");
    }
    const tasks = (input.tasks ?? []).map((t) => ({
      plan_id: m.plan_id, title: String(t.title ?? "").trim().slice(0, 300),
      assignee_id: teacherIds.has(t.assigneeId) ? t.assigneeId : null, due_date: isDate(t.due) ? t.due : null, created_by: staff.id,
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


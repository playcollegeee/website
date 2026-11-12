"use server";

import { revalidatePath } from "next/cache";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbDelete, sbFetch, sbGet } from "@/lib/supabase";
import { canEditPlan } from "@/lib/plans";
import { aiConfigured, askForJson } from "@/lib/ai";
import { allow, TOO_MANY } from "@/lib/rateLimit";

type Result = { ok: boolean; message: string };

// 設定這場會議的小幫手老師（可以改、刪任何便利貼與分區框）
export async function setHelpers(meetingId: string, teacherIds: string[]): Promise<Result> {
  try {
    const staff = await requireStaff();
    if (!isUuid(meetingId) || !Array.isArray(teacherIds) || teacherIds.length > 30 || !teacherIds.every(isUuid)) {
      return { ok: false, message: "資料不正確" };
    }
    const rows = await sbGet<{ id: string; created_by: string | null; plan: { owner_id: string | null; created_by: string | null } | null }[]>(
      `meetings?id=eq.${meetingId}&select=id,created_by,plan:plans(owner_id,created_by)`,
    );
    const m = rows[0];
    if (!m) return { ok: false, message: "找不到這場會議" };
    if (!(staff.is_admin || m.created_by === staff.id || (m.plan && canEditPlan(m.plan, staff)))) {
      return { ok: false, message: "只有會議建立者、規劃負責人或管理員可以設定小幫手" };
    }
    const ids = [...new Set(teacherIds)].filter((t) => t !== m.created_by);
    if (ids.length) {
      const ok = await sbGet<{ id: string }[]>(`teachers?id=in.(${ids.join(",")})&active=eq.true&select=id`);
      if (ok.length !== ids.length) return { ok: false, message: "有老師帳號已停用，請重新整理" };
    }
    await sbDelete(`meeting_helpers?meeting_id=eq.${meetingId}`);
    if (ids.length) {
      const res = await sbFetch("meeting_helpers", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(ids.map((t) => ({ meeting_id: meetingId, teacher_id: t, added_by: staff.id }))),
      });
      if (!res.ok) throw new Error(`儲存失敗（${res.status}）`);
    }
    await audit(actorOf(staff), "meeting.helpers", `meetings:${meetingId}`, { helpers: ids });
    revalidatePath(`/admin/meetings/${meetingId}`);
    return { ok: true, message: ids.length ? "已更新小幫手老師" : "已清除小幫手老師" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "儲存失敗" };
  }
}

// ---------- 白板第 2 批：✨ AI 整理 ----------
// AI 只給建議（分群、重複、決議與待辦候選），老師在白板上勾選後才排列或寫進規劃

export type BoardAi = {
  summary: string;
  groups: { title: string; noteIds: string[] }[];
  duplicates: { noteIds: string[]; reason: string }[];
  decisions: string[];
  tasks: { title: string; assignee: string; due: string }[];
};

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const refsSchema = { type: "array", items: { type: "string" }, description: "便利貼編號，例如 n3" };
const AI_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "白板上大家在討論什麼，2–4 句" },
    groups: {
      type: "array",
      description: "把意思相近的便利貼分成 2–6 群；每張便利貼只放一群",
      items: {
        type: "object",
        properties: { title: { type: "string", description: "這一群的分區標題，12 字以內" }, notes: refsSchema },
        required: ["title", "notes"], additionalProperties: false,
      },
    },
    duplicates: {
      type: "array",
      description: "內容重複或幾乎一樣的便利貼（沒有就回空陣列）",
      items: {
        type: "object",
        properties: { notes: refsSchema, reason: { type: "string", description: "哪裡重複，一句話" } },
        required: ["notes", "reason"], additionalProperties: false,
      },
    },
    decisions: { type: "array", items: { type: "string" }, description: "白板上看得出大家已經同意的事（沒有就空陣列，不要編造）" },
    tasks: {
      type: "array",
      description: "白板上提到要有人去做的事",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "要做的事" },
          assignee: { type: "string", description: "負責老師（便利貼上有寫才填，從老師名單挑；沒有就空字串）" },
          due: { type: "string", description: "期限 YYYY-MM-DD（有寫才填，沒有就空字串）" },
        },
        required: ["title", "assignee", "due"], additionalProperties: false,
      },
    },
  },
  required: ["summary", "groups", "duplicates", "decisions", "tasks"],
  additionalProperties: false,
};
const AI_SYSTEM = `你是「玩學院 Play Collegeee」（台中的兒童 STEAM 教室）的會議助理，幫老師整理開會時白板上的便利貼。
規則：
- 一律使用繁體中文、台灣用語，簡潔具體。
- 只根據便利貼的內容整理，不要自己編造決議或待辦。
- 分群：依主題把便利貼分成 2–6 群，每張便利貼只能出現在一群；標題要短，像白板上的分區名稱。
- 便利貼用編號（n1、n2…）表示，只能用提供的編號。
- 不要寫孩子的全名或個資；提到學生時用「某位學生」。`;

export async function organizeBoard(meetingId: string): Promise<{ ok: boolean; message: string; ai?: BoardAi }> {
  try {
    const staff = await requireStaff();
    if (!isUuid(meetingId)) return { ok: false, message: "資料不正確" };
    if (!aiConfigured()) return { ok: false, message: "還沒設定 AI 金鑰（ANTHROPIC_API_KEY）" };
    const m = (await sbGet<{ id: string; title: string; plan_id: string | null }[]>(`meetings?id=eq.${meetingId}&select=id,title,plan_id`))[0];
    if (!m) return { ok: false, message: "找不到這場會議" };
    const items = await sbGet<{ id: string; kind: string; text: string; author_id: string | null }[]>(
      `board_items?meeting_id=eq.${meetingId}&deleted_at=is.null&kind=eq.note&select=id,kind,text,author_id&order=created_at`,
    );
    const notes = items.filter((n) => n.text.trim());
    if (notes.length < 2) return { ok: false, message: "白板上至少要有 2 張寫了字的便利貼，才能請 AI 整理" };
    if (!(await allow("ai", staff.id))) return { ok: false, message: `AI ${TOO_MANY}` };
    const [teachers, agenda, plan] = await Promise.all([
      sbGet<{ id: string; name: string; nickname: string | null }[]>("teachers?active=eq.true&select=id,name,nickname"),
      sbGet<{ title: string }[]>(`meeting_agenda?meeting_id=eq.${meetingId}&select=title&order=seq,created_at`).catch(() => []),
      m.plan_id ? sbGet<{ title: string; theme: string | null }[]>(`plans?id=eq.${m.plan_id}&select=title,theme`) : Promise.resolve([]),
    ]);
    const nameOf = (id: string | null) => {
      const t = teachers.find((x) => x.id === id);
      return t ? t.nickname || t.name : "";
    };
    const ref = new Map(notes.map((n, i) => [`n${i + 1}`, n.id]));
    const raw = await askForJson<{
      summary: string; groups: { title: string; notes: string[] }[]; duplicates: { notes: string[]; reason: string }[];
      decisions: string[]; tasks: { title: string; assignee: string; due: string }[];
    }>({
      system: AI_SYSTEM,
      content: [{
        type: "text",
        text: `會議：${m.title}${plan[0] ? `（規劃：${plan[0].title}${plan[0].theme ? `・${plan[0].theme}` : ""}）` : ""}，今天 ${new Date().toISOString().slice(0, 10)}
${agenda.length ? `議程：${agenda.map((a, i) => `${i + 1}. ${a.title}`).join("；")}\n` : ""}老師名單：${teachers.map((t) => t.nickname || t.name).join("、")}

白板上的便利貼：
${notes.map((n, i) => `n${i + 1}（${nameOf(n.author_id) || "老師"}）：${n.text.replace(/\s+/g, " ").slice(0, 300)}`).join("\n")}

請直接呼叫 board_notes 工具回傳整理結果，不要另外寫文字。`,
      }],
      toolName: "board_notes",
      toolDescription: "回傳白板便利貼的分群、重複、決議與待辦建議",
      schema: AI_SCHEMA,
      maxTokens: 3000,
    });
    const ids = (a: unknown) => (Array.isArray(a) ? [...new Set(a.map((r) => ref.get(String(r).trim())).filter((x): x is string => !!x))] : []);
    const used = new Set<string>();
    const groups = (Array.isArray(raw.groups) ? raw.groups : []).slice(0, 8).map((g) => {
      const noteIds = ids(g?.notes).filter((id) => !used.has(id));
      noteIds.forEach((id) => used.add(id));
      return { title: String(g?.title ?? "").trim().slice(0, 30) || "未命名", noteIds };
    }).filter((g) => g.noteIds.length);
    const ai: BoardAi = {
      summary: String(raw.summary ?? "").trim().slice(0, 1000),
      groups,
      duplicates: (Array.isArray(raw.duplicates) ? raw.duplicates : []).slice(0, 10)
        .map((d) => ({ noteIds: ids(d?.notes), reason: String(d?.reason ?? "").trim().slice(0, 200) })).filter((d) => d.noteIds.length >= 2),
      decisions: (Array.isArray(raw.decisions) ? raw.decisions : []).map((d) => String(d ?? "").trim().slice(0, 500)).filter(Boolean).slice(0, 20),
      tasks: (Array.isArray(raw.tasks) ? raw.tasks : []).slice(0, 20).map((t) => ({
        title: String(t?.title ?? "").trim().slice(0, 300), assignee: String(t?.assignee ?? "").trim().slice(0, 40), due: isDate(t?.due) ? t.due : "",
      })).filter((t) => t.title),
    };
    await audit(actorOf(staff), "board.ai", `meetings:${meetingId}`, { notes: notes.length, groups: groups.length });
    return { ok: true, message: "AI 整理好了，請確認要套用哪些", ai };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "AI 整理失敗，請再試一次" };
  }
}

// 把老師勾選的決議與待辦寫進規劃（記成這場會議的）
export async function applyBoardAi(input: {
  meetingId: string; decisions: string[]; tasks: { title: string; assigneeId: string; due: string }[];
}): Promise<Result> {
  try {
    const staff = await requireStaff();
    if (!isUuid(input.meetingId)) return { ok: false, message: "資料不正確" };
    const m = (await sbGet<{ id: string; plan_id: string | null }[]>(`meetings?id=eq.${input.meetingId}&select=id,plan_id`))[0];
    if (!m?.plan_id) return { ok: false, message: "這場會議沒有對應的規劃" };
    const plan = (await sbGet<{ owner_id: string | null; created_by: string | null }[]>(`plans?id=eq.${m.plan_id}&select=owner_id,created_by`))[0];
    if (!plan) return { ok: false, message: "找不到這份規劃" };
    const decisions = (input.decisions ?? []).map((d) => String(d).trim().slice(0, 2900)).filter(Boolean).slice(0, 20);
    if (decisions.length && !canEditPlan(plan, staff)) return { ok: false, message: "決議只有規劃的負責老師、建立者或管理員可以套用（待辦可以）" };
    const teacherIds = new Set((await sbGet<{ id: string }[]>("teachers?active=eq.true&select=id")).map((t) => t.id));
    const now = new Date().toISOString();
    if (decisions.length) {
      const r = await sbFetch("plan_comments", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify(decisions.map((d) => ({
          plan_id: m.plan_id, meeting_id: m.id, body: d, author_id: staff.id, is_decision: true, decided_by: staff.id, decided_at: now,
        }))),
      });
      if (!r.ok) throw new Error("寫入決議失敗");
    }
    const tasks = (input.tasks ?? []).map((t) => ({
      plan_id: m.plan_id, meeting_id: m.id, title: String(t.title ?? "").trim().slice(0, 300),
      assignee_id: teacherIds.has(t.assigneeId) ? t.assigneeId : null, due_date: isDate(t.due) ? t.due : null, created_by: staff.id,
    })).filter((t) => t.title).slice(0, 20);
    if (tasks.length) {
      const r = await sbFetch("plan_tasks", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(tasks) });
      if (!r.ok) throw new Error("寫入待辦失敗");
    }
    await audit(actorOf(staff), "board.ai_apply", `meetings:${m.id}`, { decisions: decisions.length, tasks: tasks.length });
    revalidatePath(`/admin/meetings/${m.id}`);
    revalidatePath(`/admin/plans/${m.plan_id}`);
    revalidatePath("/admin");
    return { ok: true, message: `已加入 ${decisions.length} 項決議、${tasks.length} 項待辦` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "套用失敗" };
  }
}

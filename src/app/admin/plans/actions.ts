"use server";

import { revalidatePath } from "next/cache";
import { actorOf, requireStaff, type Staff } from "@/lib/staff";
import { audit, isUuid, sbDelete, sbGet, sbInsert, sbPatch } from "@/lib/supabase";
import { PLAN_KINDS, PLAN_STATUS, SECTIONS, autoTitle, campType, canEditPlan, monthRange, MAJOR_LESSONS } from "@/lib/plans";

type Result = { ok: boolean; message: string };
const fail = (e: unknown): Result => ({ ok: false, message: e instanceof Error ? e.message : "儲存失敗，請再試一次" });
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const refresh = (planId: string) => {
  revalidatePath(`/admin/plans/${planId}`);
  revalidatePath("/admin/plans");
};

async function loadPlan(id: string) {
  if (!isUuid(id)) throw new Error("資料不正確");
  const rows = await sbGet<{ id: string; kind: string; owner_id: string | null; created_by: string | null }[]>(
    `plans?id=eq.${id}&select=id,kind,owner_id,created_by`,
  );
  if (!rows[0]) throw new Error("找不到這份規劃，可能已被刪除");
  return rows[0];
}
async function mustEdit(id: string, staff: Staff) {
  const p = await loadPlan(id);
  if (!canEditPlan(p, staff)) throw new Error("只有負責老師、建立者或管理員可以修改規劃");
  return p;
}
async function teacherOk(id: string | null) {
  if (!id) return null;
  if (!isUuid(id)) throw new Error("老師資料不正確");
  const t = await sbGet<{ id: string }[]>(`teachers?id=eq.${id}&active=eq.true&select=id`);
  if (!t[0]) throw new Error("找不到這位老師");
  return id;
}

// ---------- 規劃本身 ----------
// 新增：只選時間，名稱自動產生；主題討論完再填
export async function createPlan(input: {
  kind: string; start: string; end: string; month: string; summary: string;
}): Promise<Result & { id?: string }> {
  try {
    const staff = await requireStaff();
    const kind = input.kind;
    if (!PLAN_KINDS.some((k) => k.value === kind)) return { ok: false, message: "種類不正確" };
    let start: string | null = isDate(input.start) ? input.start : null;
    let end: string | null = isDate(input.end) ? input.end : null;
    if (kind === "month") {
      const r = monthRange(input.month);
      if (!r) return { ok: false, message: "請選擇月份" };
      start = r.start;
      end = r.end;
    }
    if (!start) return { ok: false, message: "請選擇開始日期" };
    if (kind === "camp" && !end) return { ok: false, message: "請選擇營隊的結束日期" };
    if (end && end < start) return { ok: false, message: "結束日期不能早於開始日期" };
    let campCount = 0;
    if (kind === "camp") {
      const prefix = `${start.slice(0, 4)}${campType(start)}`;
      campCount = (await sbGet<{ id: string }[]>(`plans?kind=eq.camp&title=like.${encodeURIComponent(prefix + "*")}&select=id`)).length;
    }
    const title = autoTitle(kind, start, campCount);
    const p = await sbInsert<{ id: string }>("plans", {
      kind, title, start_date: start, end_date: end,
      summary: text(input.summary, 3000) || null,
      owner_id: staff.id, created_by: staff.id, updated_by: staff.id, status: "idea",
    });
    await audit(actorOf(staff), "plan.create", `plans:${p.id}`, { kind, title });
    revalidatePath("/admin/plans");
    return { ok: true, message: "已建立", id: p.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updatePlan(input: {
  id: string; title: string; theme: string; start: string; end: string; summary: string; ownerId: string;
}): Promise<Result> {
  try {
    const staff = await requireStaff();
    await mustEdit(input.id, staff);
    const title = text(input.title, 80);
    if (!title) return { ok: false, message: "請填寫名稱" };
    const start = isDate(input.start) ? input.start : null;
    const end = isDate(input.end) ? input.end : null;
    if (start && end && end < start) return { ok: false, message: "結束日期不能早於開始日期" };
    const patch = {
      title, theme: text(input.theme, 80) || null, start_date: start, end_date: end, summary: text(input.summary, 3000) || null,
      owner_id: await teacherOk(input.ownerId || null), updated_by: staff.id, updated_at: new Date().toISOString(),
    };
    await sbPatch(`plans?id=eq.${input.id}`, patch);
    await audit(actorOf(staff), "plan.update", `plans:${input.id}`, { title });
    refresh(input.id);
    return { ok: true, message: "已儲存" };
  } catch (e) {
    return fail(e);
  }
}

export async function setPlanStatus(id: string, status: string): Promise<Result> {
  try {
    const staff = await requireStaff();
    await mustEdit(id, staff);
    if (!PLAN_STATUS.some((s) => s.value === status)) return { ok: false, message: "狀態不正確" };
    await sbPatch(`plans?id=eq.${id}`, { status, updated_by: staff.id, updated_at: new Date().toISOString() });
    await audit(actorOf(staff), "plan.status", `plans:${id}`, { status });
    refresh(id);
    return { ok: true, message: "已更新狀態" };
  } catch (e) {
    return fail(e);
  }
}

// 刪除整份規劃（含內容、留言、待辦）：只有管理員
export async function deletePlan(id: string): Promise<Result> {
  try {
    const staff = await requireStaff();
    if (!staff.is_admin) return { ok: false, message: "只有管理員可以刪除規劃" };
    await loadPlan(id);
    await sbDelete(`plans?id=eq.${id}`);
    await audit(actorOf(staff), "plan.delete", `plans:${id}`, {});
    revalidatePath("/admin/plans");
    return { ok: true, message: "已刪除" };
  } catch (e) {
    return fail(e);
  }
}

// ---------- 規劃內容 ----------
export async function saveItem(input: {
  planId: string; id?: string; section: string; seq?: number; day?: string; slot?: string;
  title: string; lessonId: string; teacherId: string; notes: string;
}): Promise<Result & { id?: string }> {
  try {
    const staff = await requireStaff();
    const plan = await loadPlan(input.planId);
    const sec = SECTIONS[input.section];
    if (!sec || sec.kind !== plan.kind) return { ok: false, message: "區塊不正確" };
    const isMajor = input.section.startsWith("major_");
    const seq = isMajor ? Number(input.seq) : Number(input.seq ?? 0) || 0;
    if (isMajor && !(Number.isInteger(seq) && seq >= 1 && seq <= MAJOR_LESSONS)) return { ok: false, message: "堂次不正確" };
    const day = isDate(input.day) ? input.day : null;
    const slot = input.section === "camp" ? (input.slot === "pm" ? "pm" : "am") : null;
    if (input.section === "camp" && !day) return { ok: false, message: "營隊要有日期" };

    // 找既有的那一筆（主修用堂次、營隊用日期＋時段、其他用 id）
    let existing: { id: string; teacher_id: string | null } | undefined;
    if (input.id && isUuid(input.id)) {
      existing = (await sbGet<{ id: string; teacher_id: string | null; plan_id: string }[]>(
        `plan_items?id=eq.${input.id}&select=id,teacher_id,plan_id`,
      )).find((x) => x.plan_id === plan.id);
      if (!existing) return { ok: false, message: "找不到這一項，可能已被刪除" };
    } else if (isMajor) {
      existing = (await sbGet<{ id: string; teacher_id: string | null }[]>(
        `plan_items?plan_id=eq.${plan.id}&section=eq.${input.section}&seq=eq.${seq}&select=id,teacher_id`,
      ))[0];
    } else if (input.section === "camp") {
      existing = (await sbGet<{ id: string; teacher_id: string | null }[]>(
        `plan_items?plan_id=eq.${plan.id}&section=eq.camp&day=eq.${day}&slot=eq.${slot}&select=id,teacher_id`,
      ))[0];
    }
    // 權限：可以改規劃的人；或這一項的負責老師
    if (!canEditPlan(plan, staff) && !(existing && existing.teacher_id === staff.id)) {
      return { ok: false, message: "只有規劃的負責老師、建立者、管理員，或這一項的負責老師可以修改" };
    }
    let lessonId: string | null = null;
    if (input.lessonId) {
      if (!isUuid(input.lessonId)) return { ok: false, message: "教案資料不正確" };
      const l = await sbGet<{ id: string }[]>(`lessons?id=eq.${input.lessonId}&select=id`);
      if (!l[0]) return { ok: false, message: "找不到這個教案" };
      lessonId = input.lessonId;
    }
    const row = {
      title: text(input.title, 120) || null, lesson_id: lessonId, teacher_id: await teacherOk(input.teacherId || null),
      notes: text(input.notes, 3000) || null, day, slot, updated_by: staff.id, updated_at: new Date().toISOString(),
    };
    let id = existing?.id;
    if (id) {
      await sbPatch(`plan_items?id=eq.${id}`, row);
    } else {
      const it = await sbInsert<{ id: string }>("plan_items", { ...row, plan_id: plan.id, section: input.section, seq });
      id = it.id;
    }
    await audit(actorOf(staff), "plan.item_save", `plan_items:${id}`, { plan: plan.id, section: input.section });
    refresh(plan.id);
    return { ok: true, message: "已儲存", id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteItem(id: string): Promise<Result> {
  try {
    const staff = await requireStaff();
    if (!isUuid(id)) return { ok: false, message: "資料不正確" };
    const it = (await sbGet<{ plan_id: string }[]>(`plan_items?id=eq.${id}&select=plan_id`))[0];
    if (!it) return { ok: false, message: "找不到這一項" };
    await mustEdit(it.plan_id, staff);
    await sbDelete(`plan_items?id=eq.${id}`);
    await audit(actorOf(staff), "plan.item_delete", `plan_items:${id}`, { plan: it.plan_id });
    refresh(it.plan_id);
    return { ok: true, message: "已刪除" };
  } catch (e) {
    return fail(e);
  }
}

// ---------- 留言、決議 ----------
// 所有老師都能留言、回覆；只能改自己的；刪除只有管理員；標成「決議」限可修改規劃的人
export async function addComment(input: { planId: string; itemId?: string; parentId?: string; body: string }): Promise<Result> {
  try {
    const staff = await requireStaff();
    const plan = await loadPlan(input.planId);
    const body = text(input.body, 3000);
    if (!body) return { ok: false, message: "請輸入留言" };
    let itemId: string | null = null;
    let parentId: string | null = null;
    if (input.itemId) {
      if (!isUuid(input.itemId)) return { ok: false, message: "資料不正確" };
      const it = await sbGet<{ plan_id: string }[]>(`plan_items?id=eq.${input.itemId}&select=plan_id`);
      if (it[0]?.plan_id !== plan.id) return { ok: false, message: "找不到這一項" };
      itemId = input.itemId;
    }
    if (input.parentId) {
      if (!isUuid(input.parentId)) return { ok: false, message: "資料不正確" };
      const c = await sbGet<{ plan_id: string; item_id: string | null; parent_id: string | null }[]>(
        `plan_comments?id=eq.${input.parentId}&select=plan_id,item_id,parent_id`,
      );
      if (c[0]?.plan_id !== plan.id) return { ok: false, message: "找不到要回覆的留言" };
      parentId = c[0].parent_id ?? input.parentId; // 只有一層回覆
      itemId = c[0].item_id;
    }
    const c = await sbInsert<{ id: string }>("plan_comments", {
      plan_id: plan.id, item_id: itemId, parent_id: parentId, body, author_id: staff.id,
    });
    await audit(actorOf(staff), "plan.comment", `plan_comments:${c.id}`, { plan: plan.id });
    refresh(plan.id);
    return { ok: true, message: "已送出" };
  } catch (e) {
    return fail(e);
  }
}

async function loadComment(id: string) {
  if (!isUuid(id)) throw new Error("資料不正確");
  const c = (await sbGet<{ id: string; plan_id: string; author_id: string | null; is_decision: boolean }[]>(
    `plan_comments?id=eq.${id}&select=id,plan_id,author_id,is_decision`,
  ))[0];
  if (!c) throw new Error("找不到這則留言，可能已被刪除");
  return c;
}

export async function editComment(id: string, body: string): Promise<Result> {
  try {
    const staff = await requireStaff();
    const c = await loadComment(id);
    if (!staff.is_admin && c.author_id !== staff.id) return { ok: false, message: "只能修改自己的留言" };
    const b = text(body, 3000);
    if (!b) return { ok: false, message: "請輸入留言" };
    await sbPatch(`plan_comments?id=eq.${id}`, { body: b, updated_at: new Date().toISOString() });
    await audit(actorOf(staff), "plan.comment_edit", `plan_comments:${id}`, {});
    refresh(c.plan_id);
    return { ok: true, message: "已儲存" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteComment(id: string): Promise<Result> {
  try {
    const staff = await requireStaff();
    if (!staff.is_admin) return { ok: false, message: "只有管理員可以刪除留言" };
    const c = await loadComment(id);
    await sbDelete(`plan_comments?id=eq.${id}`);
    await audit(actorOf(staff), "plan.comment_delete", `plan_comments:${id}`, { author: c.author_id });
    refresh(c.plan_id);
    return { ok: true, message: "已刪除" };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleDecision(id: string): Promise<Result> {
  try {
    const staff = await requireStaff();
    const c = await loadComment(id);
    await mustEdit(c.plan_id, staff);
    const on = !c.is_decision;
    await sbPatch(`plan_comments?id=eq.${id}`, {
      is_decision: on, decided_by: on ? staff.id : null, decided_at: on ? new Date().toISOString() : null,
    });
    await audit(actorOf(staff), on ? "plan.decision_on" : "plan.decision_off", `plan_comments:${id}`, {});
    refresh(c.plan_id);
    return { ok: true, message: on ? "已標為決議" : "已取消決議" };
  } catch (e) {
    return fail(e);
  }
}

// ---------- 待辦 ----------
// 所有老師都能新增待辦、指派給任何老師；被指派的人、建立者、可修改規劃的人能勾完成；刪除限建立者與管理員
export async function addTask(input: { planId: string; title: string; assigneeId: string; due: string }): Promise<Result> {
  try {
    const staff = await requireStaff();
    const plan = await loadPlan(input.planId);
    const title = text(input.title, 300);
    if (!title) return { ok: false, message: "請填寫待辦事項" };
    const t = await sbInsert<{ id: string }>("plan_tasks", {
      plan_id: plan.id, title, assignee_id: await teacherOk(input.assigneeId || null),
      due_date: isDate(input.due) ? input.due : null, created_by: staff.id,
    });
    await audit(actorOf(staff), "plan.task_add", `plan_tasks:${t.id}`, { plan: plan.id, assignee: input.assigneeId || null });
    refresh(plan.id);
    revalidatePath("/admin");
    return { ok: true, message: "已新增待辦" };
  } catch (e) {
    return fail(e);
  }
}

async function loadTask(id: string) {
  if (!isUuid(id)) throw new Error("資料不正確");
  const t = (await sbGet<{ id: string; plan_id: string; assignee_id: string | null; created_by: string | null; done_at: string | null }[]>(
    `plan_tasks?id=eq.${id}&select=id,plan_id,assignee_id,created_by,done_at`,
  ))[0];
  if (!t) throw new Error("找不到這個待辦，可能已被刪除");
  return t;
}

export async function toggleTask(id: string): Promise<Result> {
  try {
    const staff = await requireStaff();
    const t = await loadTask(id);
    const plan = await loadPlan(t.plan_id);
    if (!(t.assignee_id === staff.id || t.created_by === staff.id || canEditPlan(plan, staff))) {
      return { ok: false, message: "只有被指派的老師、建立者或規劃負責人可以勾選" };
    }
    const done = !t.done_at;
    await sbPatch(`plan_tasks?id=eq.${id}`, { done_at: done ? new Date().toISOString() : null, done_by: done ? staff.id : null });
    await audit(actorOf(staff), done ? "plan.task_done" : "plan.task_undo", `plan_tasks:${id}`, {});
    refresh(t.plan_id);
    revalidatePath("/admin");
    return { ok: true, message: done ? "已完成" : "已改回未完成" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTask(id: string): Promise<Result> {
  try {
    const staff = await requireStaff();
    const t = await loadTask(id);
    if (!(staff.is_admin || t.created_by === staff.id)) return { ok: false, message: "只有建立者或管理員可以刪除待辦" };
    await sbDelete(`plan_tasks?id=eq.${id}`);
    await audit(actorOf(staff), "plan.task_delete", `plan_tasks:${id}`, {});
    refresh(t.plan_id);
    revalidatePath("/admin");
    return { ok: true, message: "已刪除" };
  } catch (e) {
    return fail(e);
  }
}

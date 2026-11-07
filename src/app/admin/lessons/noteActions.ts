"use server";

import { revalidatePath } from "next/cache";
import { actorOf, requireStaff, type Staff } from "@/lib/staff";
import { audit, isUuid, sbDelete, sbGet, sbInsert, sbPatch } from "@/lib/supabase";
import { NOTE_KINDS, canEditNote, type NoteKind } from "@/lib/lessons";

type Result = { ok: boolean; message: string };
const fail = (e: unknown): Result => ({ ok: false, message: e instanceof Error ? e.message : "儲存失敗，請再試一次" });

// 內容與連結的檢查（連結只收 http/https）
function clean(input: { body: string; url: string }) {
  const body = String(input.body ?? "").trim().slice(0, 3000);
  let url: string | null = String(input.url ?? "").trim().slice(0, 500) || null;
  if (url && !/^https?:\/\/\S+$/i.test(url)) throw new Error("連結要以 http:// 或 https:// 開頭");
  if (!body) throw new Error("請填寫內容");
  return { body, url };
}

async function loadNote(id: string) {
  if (!isUuid(id)) throw new Error("資料不正確");
  const rows = await sbGet<{ id: string; lesson_id: string; author_id: string | null }[]>(
    `lesson_notes?id=eq.${id}&select=id,lesson_id,author_id`,
  );
  if (!rows[0]) throw new Error("找不到這筆資料，可能已被刪除");
  return rows[0];
}

const done = (staff: Staff, lessonId: string) => revalidatePath(`/admin/lessons/${lessonId}`);

// 新增：所有老師都可以
export async function addNote(input: { lessonId: string; kind: NoteKind; body: string; url: string }): Promise<Result> {
  try {
    const staff = await requireStaff();
    if (!isUuid(input.lessonId) || !NOTE_KINDS.some((k) => k.value === input.kind)) return { ok: false, message: "資料不正確" };
    const { body, url } = clean(input);
    const exists = await sbGet<{ id: string }[]>(`lessons?id=eq.${input.lessonId}&select=id`);
    if (!exists[0]) return { ok: false, message: "找不到這個教案" };
    const row = await sbInsert<{ id: string }[]>("lesson_notes", {
      lesson_id: input.lessonId, kind: input.kind, body, url, author_id: staff.id, updated_by: staff.id,
    });
    await audit(actorOf(staff), "lesson.note_add", `lesson_notes:${row[0]?.id ?? "?"}`, { lesson: input.lessonId, kind: input.kind });
    done(staff, input.lessonId);
    return { ok: true, message: "已新增" };
  } catch (e) {
    return fail(e);
  }
}

// 編輯：自己寫的；舊資料與其他老師寫的只有管理員
export async function updateNote(input: { id: string; body: string; url: string }): Promise<Result> {
  try {
    const staff = await requireStaff();
    const note = await loadNote(input.id);
    if (!canEditNote(note, staff)) return { ok: false, message: "只能編輯自己寫的內容（其他老師寫的與舊資料請找管理員）" };
    const { body, url } = clean(input);
    await sbPatch(`lesson_notes?id=eq.${note.id}`, { body, url, updated_by: staff.id, updated_at: new Date().toISOString() });
    await audit(actorOf(staff), "lesson.note_edit", `lesson_notes:${note.id}`, { lesson: note.lesson_id });
    done(staff, note.lesson_id);
    return { ok: true, message: "已儲存" };
  } catch (e) {
    return fail(e);
  }
}

// 刪除：只有管理員
export async function deleteNote(id: string): Promise<Result> {
  try {
    const staff = await requireStaff();
    if (!staff.is_admin) return { ok: false, message: "只有管理員可以刪除" };
    const note = await loadNote(id);
    await sbDelete(`lesson_notes?id=eq.${note.id}`);
    await audit(actorOf(staff), "lesson.note_delete", `lesson_notes:${note.id}`, { lesson: note.lesson_id, author: note.author_id });
    done(staff, note.lesson_id);
    return { ok: true, message: "已刪除" };
  } catch (e) {
    return fail(e);
  }
}

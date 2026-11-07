"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actorOf, requireStaff, type Staff } from "@/lib/staff";
import { audit, isUuid, sbDelete, sbFetch, sbGet, sbInsert, sbPatch } from "@/lib/supabase";
import { LEVEL_NAME, optStr, str } from "@/lib/admin";
import { NOTE_KINDS, TAG_KINDS, canEditLesson, cleanTagName, parseMaterials, parseSteps, type Tag } from "@/lib/lessons";

const int = (v: string, min: number, max: number): number | null => {
  const n = Number(v);
  return v !== "" && Number.isInteger(n) && n >= min && n <= max ? n : null;
};

// 把表單裡各類標籤的名稱轉成標籤 id；詞庫裡沒有的就新增
async function resolveTags(fd: FormData, staff: Staff): Promise<string[]> {
  const wanted: { kind: string; name: string }[] = [];
  for (const k of TAG_KINDS) {
    const names = new Set(fd.getAll(`tags_${k.value}`).map((v) => cleanTagName(String(v))).filter(Boolean));
    for (const name of [...names].slice(0, 20)) wanted.push({ kind: k.value, name });
  }
  if (wanted.length === 0) return [];
  const all = await sbGet<Tag[]>("tags?select=id,kind,name");
  const key = (t: { kind: string; name: string }) => `${t.kind}|${t.name.toLowerCase()}`;
  const have = new Map(all.map((t) => [key(t), t.id]));
  const missing = wanted.filter((w) => !have.has(key(w)));
  if (missing.length) {
    const res = await sbFetch("tags?on_conflict=kind,name", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify(missing.map((m) => ({ ...m, created_by: staff.id }))),
    });
    if (!res.ok) throw new Error("新增標籤失敗");
    for (const t of (await res.json()) as Tag[]) have.set(key(t), t.id);
    // 同時有人新增同名標籤時，ignore-duplicates 不會回傳那一筆，再讀一次補齊
    if (missing.some((m) => !have.has(key(m)))) {
      for (const t of await sbGet<Tag[]>("tags?select=id,kind,name")) have.set(key(t), t.id);
    }
  }
  return [...new Set(wanted.map((w) => have.get(key(w))).filter((v): v is string => !!v))];
}

// 新增或修改教案
export async function saveLesson(fd: FormData) {
  const staff = await requireStaff();
  const id = str(fd, "id", 40);
  const editing = isUuid(id);

  const title = str(fd, "title", 80);
  const categoryId = str(fd, "category_id", 40);
  if (!title) throw new Error("請填寫教案標題");
  if (!isUuid(categoryId)) throw new Error("請選擇課程類別");
  const cats = await sbGet<{ id: string; active: boolean }[]>(`lesson_categories?id=eq.${categoryId}&select=id,active`);
  if (!cats[0]) throw new Error("找不到這個課程類別");

  if (editing) {
    const rows = await sbGet<{ author_id: string | null; category_id: string | null }[]>(
      `lessons?id=eq.${id}&select=author_id,category_id`,
    );
    if (!rows[0]) throw new Error("找不到這個教案");
    if (!canEditLesson(staff, rows[0].author_id)) throw new Error("只有作者或管理員可以修改這個教案");
    // 停用的類別：舊教案可以留在原類別，但不能把教案改到停用的類別
    if (!cats[0].active && rows[0].category_id !== categoryId) throw new Error("這個課程類別已停用");
  } else if (!cats[0].active) {
    throw new Error("這個課程類別已停用");
  }

  const status = str(fd, "status", 10);
  const row = {
    title,
    category_id: categoryId,
    levels: fd.getAll("levels").map(String).filter((l) => LEVEL_NAME[l]),
    difficulty: int(str(fd, "difficulty", 1), 1, 5),
    minutes: int(str(fd, "minutes", 3), 10, 480) ?? 90,
    summary: optStr(fd, "summary", 200),
    challenge: optStr(fd, "challenge", 2000),
    support: optStr(fd, "support", 2000),
    materials: parseMaterials(str(fd, "materials", 20000)),
    tips: optStr(fd, "tips", 3000),
    xp: int(str(fd, "xp", 3), 0, 100) ?? 10,
    status: ["ready", "archived"].includes(status) ? status : "draft",
    updated_by: staff.id,
    updated_at: new Date().toISOString(),
  };

  let lessonId = id;
  if (editing) {
    await sbPatch(`lessons?id=eq.${id}`, row);
  } else {
    const l = await sbInsert<{ id: string }>("lessons", { ...row, author_id: staff.id });
    lessonId = l.id;
  }

  // 標籤：整組換掉
  const tagIds = await resolveTags(fd, staff);
  if (editing) await sbDelete(`lesson_tags?lesson_id=eq.${lessonId}`);
  if (tagIds.length) {
    const res = await sbFetch("lesson_tags", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(tagIds.map((tag_id) => ({ lesson_id: lessonId, tag_id }))),
    });
    if (!res.ok) throw new Error("儲存標籤失敗");
  }

  // 表單裡新寫的「參考資料」「參考進行活動」：各新增一筆，作者是自己（之後在教案頁編輯）
  const notes = NOTE_KINDS.map((k) => ({ kind: k.value, body: str(fd, `note_${k.value}`, 3000).trim() })).filter((n) => n.body);
  if (notes.length) {
    const res = await sbFetch("lesson_notes", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(notes.map((n) => ({ lesson_id: lessonId, kind: n.kind, body: n.body, author_id: staff.id, updated_by: staff.id }))),
    });
    if (!res.ok) throw new Error("儲存參考資料失敗（請確認 0010 已執行）");
  }

  await audit(actorOf(staff), editing ? "lesson.update" : "lesson.create", `lessons:${lessonId}`, {
    title, status: row.status, notes: notes.length,
  });
  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/lessons/${lessonId}`);
  redirect(`/admin/lessons/${lessonId}`);
}

// 合作單位版（學習目標、三段流程、給家長的話、活動簡介）：在教案頁需要時才產生、編輯。
// 帶課的老師常常不是作者，所以所有老師都可以存；每次存檔都記操作紀錄。
export async function saveCollab(fd: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const staff = await requireStaff();
    const id = str(fd, "id", 40);
    if (!isUuid(id)) return { ok: false, message: "資料不正確" };
    const rows = await sbGet<{ id: string }[]>(`lessons?id=eq.${id}&select=id`);
    if (!rows[0]) return { ok: false, message: "找不到這個教案" };
    const row = {
      goals: optStr(fd, "goals", 2000),
      refs: optStr(fd, "refs", 3000),
      timeline: parseSteps(str(fd, "timeline", 100000)),
      parent_note: optStr(fd, "parent_note", 1000),
      outline: optStr(fd, "outline", 1000),
      updated_by: staff.id,
      updated_at: new Date().toISOString(),
    };
    await sbPatch(`lessons?id=eq.${id}`, row);
    await audit(actorOf(staff), "lesson.collab", `lessons:${id}`, { steps: row.timeline.length });
    revalidatePath(`/admin/lessons/${id}`);
    return { ok: true, message: "已儲存合作單位版" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "儲存失敗，請再試一次" };
  }
}

// 改狀態：草稿／可使用／封存
export async function setLessonStatus(fd: FormData) {
  const staff = await requireStaff();
  const id = str(fd, "id", 40);
  const status = str(fd, "status", 10);
  if (!isUuid(id) || !["draft", "ready", "archived"].includes(status)) throw new Error("資料不正確");
  const rows = await sbGet<{ author_id: string | null }[]>(`lessons?id=eq.${id}&select=author_id`);
  if (!rows[0]) throw new Error("找不到這個教案");
  if (!canEditLesson(staff, rows[0].author_id)) throw new Error("只有作者或管理員可以改這個教案的狀態");
  await sbPatch(`lessons?id=eq.${id}`, { status, updated_by: staff.id, updated_at: new Date().toISOString() });
  await audit(actorOf(staff), "lesson.status", `lessons:${id}`, { status });
  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/lessons/${id}`);
}

// 班級頁：替某一堂換教案（所有老師都可以）
export async function setSessionLesson(fd: FormData) {
  const staff = await requireStaff();
  const sessionId = str(fd, "session_id", 40);
  const lessonId = str(fd, "lesson_id", 40);
  if (!isUuid(sessionId)) throw new Error("資料不正確");
  const sess = await sbGet<{ class_id: string }[]>(`sessions?id=eq.${sessionId}&select=class_id`);
  if (!sess[0]) throw new Error("找不到堂次");

  let version: number | null = null;
  if (lessonId) {
    if (!isUuid(lessonId)) throw new Error("資料不正確");
    const l = await sbGet<{ version: number; status: string }[]>(`lessons?id=eq.${lessonId}&select=version,status`);
    if (!l[0]) throw new Error("找不到這個教案");
    if (l[0].status === "archived") throw new Error("這個教案已封存，不能排課");
    version = l[0].version;
  }
  await sbPatch(`sessions?id=eq.${sessionId}`, { lesson_id: lessonId || null });
  // 已經點過名的話，出席紀錄上的教案版本跟著更新
  await sbPatch(`attendance?session_id=eq.${sessionId}`, { lesson_version: version });
  await audit(actorOf(staff), "session.lesson", `sessions:${sessionId}`, { lesson: lessonId || null });
  revalidatePath(`/admin/classes/${sess[0].class_id}`);
  revalidatePath(`/admin/sessions/${sessionId}`);
}

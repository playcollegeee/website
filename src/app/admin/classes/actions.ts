"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbGet, sbInsert, sbPatch, sbRpc } from "@/lib/supabase";
import { CLASS_KIND, LEVEL_NAME, MAJOR_NAME, fromTaipeiLocal, optStr, str } from "@/lib/admin";

const int = (v: string, min: number, max: number, dflt: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : dflt;
};

export async function createClass(fd: FormData) {
  const staff = await requireStaff();

  // 1. 課程系列：選現有的，或當場新增
  let courseId = str(fd, "course_id", 40);
  if (courseId === "new") {
    const title = str(fd, "course_title", 60);
    const kind = str(fd, "course_kind", 20);
    const major = str(fd, "course_major", 10);
    const levels = fd.getAll("course_levels").map(String).filter((l) => LEVEL_NAME[l]);
    if (!title || !CLASS_KIND[kind] || levels.length === 0) throw new Error("請填寫新課程的名稱、類型與適合階段");
    const c = await sbInsert<{ id: string }>("courses", {
      title, kind, major: MAJOR_NAME[major] ? major : null, levels, published: false,
    });
    courseId = c.id;
    await audit(actorOf(staff), "course.create", `courses:${c.id}`, { title });
  }
  if (!isUuid(courseId)) throw new Error("請選擇課程");

  const name = str(fd, "name", 60);
  if (!name) throw new Error("請填寫班名");
  const first = fromTaipeiLocal(str(fd, "first", 20));
  if (!first) throw new Error("請填寫第一堂的日期時間");
  const count = int(str(fd, "count", 3), 1, 60, 12);
  const minutes = int(str(fd, "minutes", 3), 15, 480, 90);
  const every = int(str(fd, "every", 3), 1, 31, 7);
  const teacherId = str(fd, "teacher_id", 40);

  const cl = await sbInsert<{ id: string }>("classes", {
    course_id: courseId,
    teacher_id: isUuid(teacherId) ? teacherId : null,
    name,
    room: optStr(fd, "room", 20),
    capacity: int(str(fd, "capacity", 3), 1, 100, 8),
    starts_on: first.toISOString().slice(0, 10),
    ends_on: new Date(first.getTime() + (count - 1) * every * 86400000 + 86400000).toISOString().slice(0, 10),
    note: optStr(fd, "note", 500),
  });
  await sbRpc("generate_sessions", { p_class: cl.id, p_first: first.toISOString(), p_count: count, p_minutes: minutes, p_every_days: every });
  await audit(actorOf(staff), "class.create", `classes:${cl.id}`, { name, count });
  revalidatePath("/admin/classes");
  redirect(`/admin/classes/${cl.id}`);
}

export async function updateClass(fd: FormData) {
  const staff = await requireStaff();
  const id = str(fd, "id", 40);
  if (!isUuid(id)) throw new Error("資料不正確");
  const teacherId = str(fd, "teacher_id", 40);
  await sbPatch(`classes?id=eq.${id}`, {
    name: str(fd, "name", 60) || undefined,
    teacher_id: isUuid(teacherId) ? teacherId : null,
    room: optStr(fd, "room", 20),
    capacity: int(str(fd, "capacity", 3), 1, 100, 8),
    note: optStr(fd, "note", 500),
  });
  await audit(actorOf(staff), "class.update", `classes:${id}`);
  revalidatePath(`/admin/classes/${id}`);
}

// 調整單一堂次時間（例如颱風假改期）
export async function moveSession(fd: FormData) {
  const staff = await requireStaff();
  const id = str(fd, "id", 40);
  const start = fromTaipeiLocal(str(fd, "start", 20));
  if (!isUuid(id) || !start) throw new Error("資料不正確");
  const rows = await sbGet<{ starts_at: string; ends_at: string; class_id: string }[]>(`sessions?id=eq.${id}&select=starts_at,ends_at,class_id`);
  const s = rows[0];
  if (!s) throw new Error("找不到堂次");
  const len = new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime();
  await sbPatch(`sessions?id=eq.${id}`, { starts_at: start.toISOString(), ends_at: new Date(start.getTime() + len).toISOString() });
  await audit(actorOf(staff), "session.move", `sessions:${id}`, { from: s.starts_at, to: start.toISOString() });
  revalidatePath(`/admin/classes/${s.class_id}`);
  revalidatePath(`/admin/sessions/${id}`);
}

// 加開一堂（補課）
export async function addSession(fd: FormData) {
  const staff = await requireStaff();
  const classId = str(fd, "class_id", 40);
  const start = fromTaipeiLocal(str(fd, "start", 20));
  const minutes = int(str(fd, "minutes", 3), 15, 480, 90);
  if (!isUuid(classId) || !start) throw new Error("請填寫日期時間");
  const s = await sbInsert<{ id: string }>("sessions", {
    class_id: classId, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + minutes * 60000).toISOString(),
  });
  await audit(actorOf(staff), "session.add", `sessions:${s.id}`, { class: classId });
  revalidatePath(`/admin/classes/${classId}`);
}

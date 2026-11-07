"use server";

import { revalidatePath } from "next/cache";
import { actorOf, requireStaff, type Staff } from "@/lib/staff";
import { audit, isUuid, sbDelete, sbGet, sbInsert, sbPatch, sbRemoveFile, sbUpload } from "@/lib/supabase";
import { str } from "@/lib/admin";
import { LESSON_BUCKET, canEditLesson } from "@/lib/lessons";

// 教案照片與組裝圖檔（.io）。檔案放私人 bucket「lesson-files」，只有後台伺服器能讀寫。
// 回傳 { ok, message } 而不是丟錯誤：正式站會把錯誤訊息藏起來，這樣老師才看得到原因。
const MAX_PHOTO = 4 * 1024 * 1024; // 瀏覽器已縮圖，正常約 100–400 KB
const MAX_THUMB = 1024 * 1024;
const MAX_IO = 4 * 1024 * 1024; // 伺服器動作上傳上限 4 MB；目前的 .io 都在 1 MB 以內
const IMAGE_TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg" };

export type FileResult = { ok: boolean; message: string };

type FileRow = {
  id: string; lesson_id: string; kind: string; storage_path: string; thumb_path: string | null;
  is_cover: boolean; uploaded_by: string | null; file_name: string | null;
};

const rand = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const done = (lessonId: string) => {
  revalidatePath(`/admin/lessons/${lessonId}`);
  revalidatePath("/admin/lessons");
};

async function lessonOf(lessonId: string) {
  if (!isUuid(lessonId)) return null;
  const rows = await sbGet<{ id: string; author_id: string | null }[]>(`lessons?id=eq.${lessonId}&select=id,author_id`);
  return rows[0] ?? null;
}

// 刪檔、換封面：上傳的人、教案作者或管理員
const canManage = (staff: Staff, f: FileRow, authorId: string | null) =>
  canEditLesson(staff, authorId) || (f.uploaded_by !== null && f.uploaded_by === staff.id);

// 上傳一張照片（瀏覽器已轉成 WebP／JPEG 並另外產生縮圖）
export async function uploadLessonPhoto(fd: FormData): Promise<FileResult> {
  try {
    const staff = await requireStaff();
    const lesson = await lessonOf(str(fd, "lesson_id", 40));
    if (!lesson) return { ok: false, message: "找不到這個教案" };
    const file = fd.get("file");
    const thumb = fd.get("thumb");
    if (!(file instanceof Blob) || file.size === 0 || !(thumb instanceof Blob) || thumb.size === 0) {
      return { ok: false, message: "請選一張照片" };
    }
    const ext = IMAGE_TYPES[file.type];
    if (!ext || !IMAGE_TYPES[thumb.type]) return { ok: false, message: "照片格式不正確" };
    if (file.size > MAX_PHOTO || thumb.size > MAX_THUMB) return { ok: false, message: "照片太大" };
    const width = Math.min(Math.max(Number(fd.get("width")) || 0, 1), 6000);
    const height = Math.min(Math.max(Number(fd.get("height")) || 0, 1), 6000);
    const name = str(fd, "name", 120) || `photo.${ext}`;

    const base = `lessons/${lesson.id}/${rand()}`;
    const path = `${base}.${ext}`;
    const thumbPath = `${base}-t.${IMAGE_TYPES[thumb.type]}`;
    await sbUpload(LESSON_BUCKET, path, file, file.type);
    await sbUpload(LESSON_BUCKET, thumbPath, thumb, thumb.type);

    const existing = await sbGet<{ sort: number; is_cover: boolean }[]>(
      `lesson_files?lesson_id=eq.${lesson.id}&kind=eq.image&select=sort,is_cover&order=sort.desc`,
    );
    const row = await sbInsert<{ id: string }>("lesson_files", {
      lesson_id: lesson.id, kind: "image", storage_path: path, thumb_path: thumbPath, file_name: name,
      mime: file.type, size_bytes: file.size, width, height,
      sort: (existing[0]?.sort ?? 0) + 1,
      is_cover: !existing.some((e) => e.is_cover), // 第一張照片自動當封面
      uploaded_by: staff.id,
    });
    await audit(actorOf(staff), "lesson_file.upload", `lesson_files:${row.id}`, { lesson: lesson.id, kind: "image", name });
    done(lesson.id);
    return { ok: true, message: `已上傳 ${name}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "上傳失敗" };
  }
}

// 上傳組裝圖檔（BrickLink Studio .io）；同一個教案已有同名檔案就跳過
export async function uploadLessonModel(fd: FormData): Promise<FileResult> {
  try {
    const staff = await requireStaff();
    const lesson = await lessonOf(str(fd, "lesson_id", 40));
    if (!lesson) return { ok: false, message: "找不到這個教案" };
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "請選一個 .io 檔" };
    const name = file.name.replace(/[\\/]/g, "_").slice(0, 120);
    if (!/\.io$/i.test(name)) return { ok: false, message: "只接受 BrickLink Studio 的 .io 檔" };
    if (file.size > MAX_IO) return { ok: false, message: ".io 檔太大（上限 4 MB）" };

    const dup = await sbGet<{ id: string }[]>(
      `lesson_files?lesson_id=eq.${lesson.id}&kind=eq.model_io&file_name=eq.${encodeURIComponent(name)}&select=id`,
    );
    if (dup.length) return { ok: true, message: `${name} 已經有了，略過` };

    const path = `lessons/${lesson.id}/${rand()}.io`;
    await sbUpload(LESSON_BUCKET, path, file, "application/octet-stream");
    const last = await sbGet<{ sort: number }[]>(
      `lesson_files?lesson_id=eq.${lesson.id}&kind=eq.model_io&select=sort&order=sort.desc&limit=1`,
    );
    const row = await sbInsert<{ id: string }>("lesson_files", {
      lesson_id: lesson.id, kind: "model_io", storage_path: path, file_name: name,
      mime: "application/octet-stream", size_bytes: file.size, sort: (last[0]?.sort ?? 0) + 1, uploaded_by: staff.id,
    });
    await audit(actorOf(staff), "lesson_file.upload", `lesson_files:${row.id}`, { lesson: lesson.id, kind: "model_io", name });
    done(lesson.id);
    return { ok: true, message: `已上傳 ${name}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "上傳失敗" };
  }
}

async function fileAndLesson(id: string) {
  if (!isUuid(id)) return null;
  const rows = await sbGet<(FileRow & { lessons: { author_id: string | null } })[]>(
    `lesson_files?id=eq.${id}&select=id,lesson_id,kind,storage_path,thumb_path,is_cover,uploaded_by,file_name,lessons(author_id)`,
  );
  return rows[0] ?? null;
}

export async function deleteLessonFile(fd: FormData): Promise<FileResult> {
  try {
    const staff = await requireStaff();
    const f = await fileAndLesson(str(fd, "id", 40));
    if (!f) return { ok: false, message: "找不到這個檔案" };
    if (!canManage(staff, f, f.lessons.author_id)) return { ok: false, message: "只有上傳的人、教案作者或管理員可以刪除" };
    await sbDelete(`lesson_files?id=eq.${f.id}`);
    await sbRemoveFile(LESSON_BUCKET, f.storage_path);
    if (f.thumb_path) await sbRemoveFile(LESSON_BUCKET, f.thumb_path);
    // 刪掉的是封面：改用下一張照片
    if (f.is_cover) {
      const next = await sbGet<{ id: string }[]>(
        `lesson_files?lesson_id=eq.${f.lesson_id}&kind=eq.image&select=id&order=sort&limit=1`,
      );
      if (next[0]) await sbPatch(`lesson_files?id=eq.${next[0].id}`, { is_cover: true });
    }
    await audit(actorOf(staff), "lesson_file.delete", `lesson_files:${f.id}`, { lesson: f.lesson_id, name: f.file_name });
    done(f.lesson_id);
    return { ok: true, message: "已刪除" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "刪除失敗" };
  }
}

export async function setLessonCover(fd: FormData): Promise<FileResult> {
  try {
    const staff = await requireStaff();
    const f = await fileAndLesson(str(fd, "id", 40));
    if (!f || f.kind !== "image") return { ok: false, message: "找不到這張照片" };
    if (!canManage(staff, f, f.lessons.author_id)) return { ok: false, message: "只有上傳的人、教案作者或管理員可以換封面" };
    await sbPatch(`lesson_files?lesson_id=eq.${f.lesson_id}&is_cover=eq.true`, { is_cover: false });
    await sbPatch(`lesson_files?id=eq.${f.id}`, { is_cover: true });
    await audit(actorOf(staff), "lesson_file.cover", `lesson_files:${f.id}`, { lesson: f.lesson_id });
    done(f.lesson_id);
    return { ok: true, message: "已設為封面" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "設定失敗" };
  }
}

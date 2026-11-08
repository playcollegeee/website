"use server";

import { revalidatePath, updateTag } from "next/cache";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbDelete, sbGet, sbInsert, sbPatch, sbRemoveFile, sbUpload } from "@/lib/supabase";
import { ACTIVITY_FOLDER, ACTIVITY_TAG, AUDIENCE_LABEL, KIND_LABEL, type Activity } from "@/lib/activities";
import { PHOTO_BUCKET } from "@/lib/sitePhotos";
import { str } from "@/lib/admin";

export type ActResult = { ok: boolean; message: string };

const TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const MAX_BYTES = 4 * 1024 * 1024;

function refresh() {
  updateTag(ACTIVITY_TAG); // 官網活動快取立即更新
  revalidatePath("/workshops");
  revalidatePath("/admin/activities");
}

// 新增或修改一個活動（有選新照片就一起上傳）
export async function saveActivity(fd: FormData): Promise<ActResult> {
  const staff = await requireStaff(true);
  try {
    const id = str(fd, "id", 40);
    const title = str(fd, "title", 60);
    const kind = str(fd, "kind", 20);
    const audience = str(fd, "audience", 20);
    const signup = str(fd, "signup", 20);
    let signup_url = str(fd, "signup_url", 300) || null;
    if (id && !isUuid(id)) return { ok: false, message: "資料不正確" };
    if (!title) return { ok: false, message: "請填活動名稱" };
    if (!(kind in KIND_LABEL)) return { ok: false, message: "活動類型不正確" };
    if (!(audience in AUDIENCE_LABEL)) return { ok: false, message: "對象不正確" };
    if (!["contact", "link", "none"].includes(signup)) return { ok: false, message: "報名方式不正確" };
    if (signup === "link") {
      if (!signup_url || !/^https:\/\/[^\s<>"]+$/.test(signup_url)) return { ok: false, message: "外部報名連結要是 https:// 開頭的網址" };
    } else signup_url = null;

    const tags = str(fd, "tags", 200)
      .split(/[,，、\n]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6);

    const fields = {
      title,
      kind,
      audience,
      audience_text: str(fd, "audience_text", 80) || null,
      summary: str(fd, "summary", 600),
      tags,
      schedule_text: str(fd, "schedule_text", 120) || null,
      price_text: str(fd, "price_text", 80) || null,
      signup,
      signup_url,
      published: fd.get("published") === "on",
    };

    const file = fd.get("file");
    let upload: { image_url: string; storage_path: string; width: number; height: number } | null = null;
    if (file instanceof Blob && file.size > 0) {
      const ext = TYPES[file.type];
      if (!ext) return { ok: false, message: "只接受 JPG、PNG 或 WebP 圖片" };
      if (file.size > MAX_BYTES) return { ok: false, message: "圖片太大（上限 4 MB）" };
      const width = Math.min(Math.max(Number(fd.get("width")) || 1100, 50), 4000);
      const height = Math.min(Math.max(Number(fd.get("height")) || 825, 50), 4000);
      const path = `${ACTIVITY_FOLDER}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const image_url = await sbUpload(PHOTO_BUCKET, path, file, file.type);
      upload = { image_url, storage_path: path, width, height };
    }

    if (id) {
      const old = (await sbGet<Activity[]>(`activities?id=eq.${id}&select=*`))[0];
      if (!old) return { ok: false, message: "找不到這個活動" };
      await sbPatch(`activities?id=eq.${id}`, { ...fields, ...(upload ?? {}) });
      if (upload && old.storage_path) await sbRemoveFile(PHOTO_BUCKET, old.storage_path); // 換圖後刪掉舊檔
      await audit(actorOf(staff), "activity.update", `activities:${id}`, { title, replacedImage: !!upload, published: fields.published });
      refresh();
      return { ok: true, message: upload ? "已更換照片並儲存" : "已儲存" };
    }

    const last = await sbGet<{ sort: number }[]>("activities?select=sort&order=sort.desc&limit=1");
    const row = await sbInsert<Activity>("activities", { ...fields, ...(upload ?? {}), sort: (last[0]?.sort ?? 0) + 1, created_by: staff.id });
    await audit(actorOf(staff), "activity.create", `activities:${row?.id ?? ""}`, { title, audience });
    refresh();
    return { ok: true, message: "已新增活動" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "儲存失敗" };
  }
}

// 調整順序：和上一個／下一個交換位置
export async function moveActivity(id: string, dir: "up" | "down"): Promise<ActResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id)) return { ok: false, message: "資料不正確" };
  const list = await sbGet<{ id: string; sort: number }[]>("activities?select=id,sort&order=sort,created_at");
  const i = list.findIndex((p) => p.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true, message: "" };
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((p, k) => (p.sort === k + 1 ? null : sbPatch(`activities?id=eq.${p.id}`, { sort: k + 1 }))));
  await audit(actorOf(staff), "activity.move", `activities:${id}`, { dir });
  refresh();
  return { ok: true, message: "" };
}

export async function deleteActivity(id: string): Promise<ActResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id)) return { ok: false, message: "資料不正確" };
  const old = (await sbGet<Activity[]>(`activities?id=eq.${id}&select=*`))[0];
  if (!old) return { ok: true, message: "已刪除" };
  await sbDelete(`activities?id=eq.${id}`);
  if (old.storage_path) await sbRemoveFile(PHOTO_BUCKET, old.storage_path);
  await audit(actorOf(staff), "activity.delete", `activities:${id}`, { title: old.title });
  refresh();
  return { ok: true, message: "已刪除" };
}

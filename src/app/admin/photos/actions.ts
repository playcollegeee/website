"use server";

import { revalidatePath, updateTag } from "next/cache";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbDelete, sbGet, sbInsert, sbPatch, sbRemoveFile, sbUpload } from "@/lib/supabase";
import { PHOTO_BUCKET, PHOTO_TAG, type PhotoSection, type SitePhoto } from "@/lib/sitePhotos";
import { str } from "@/lib/admin";

export type PhotoResult = { ok: true; message: string } | { ok: false; message: string };

const SECTIONS: PhotoSection[] = ["highlights", "gallery"];
const COLORS = ["yellow", "green", "red", "blue"];
const TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const MAX_BYTES = 4 * 1024 * 1024;

function refresh() {
  updateTag(PHOTO_TAG); // 官網照片快取立即更新
  revalidatePath("/");
  revalidatePath("/admin/photos");
}

// 新增或修改一張照片（有選新圖片就一起上傳）
export async function savePhoto(fd: FormData): Promise<PhotoResult> {
  const staff = await requireStaff(true);
  try {
    const id = str(fd, "id", 40);
    const section = str(fd, "section", 20) as PhotoSection;
    const title = str(fd, "title", 80);
    const tag = str(fd, "tag", 30) || null;
    const body = str(fd, "body", 300) || null;
    const color = str(fd, "color", 10) || "yellow";
    const published = fd.get("published") === "on";
    if (!SECTIONS.includes(section)) return { ok: false, message: "區塊不正確" };
    if (!title) return { ok: false, message: section === "gallery" ? "請填照片說明" : "請填標題" };
    if (!COLORS.includes(color)) return { ok: false, message: "顏色不正確" };
    if (id && !isUuid(id)) return { ok: false, message: "資料不正確" };

    const file = fd.get("file");
    let upload: { image_url: string; storage_path: string; width: number; height: number } | null = null;
    if (file instanceof Blob && file.size > 0) {
      const ext = TYPES[file.type];
      if (!ext) return { ok: false, message: "只接受 JPG、PNG 或 WebP 圖片" };
      if (file.size > MAX_BYTES) return { ok: false, message: "圖片太大（上限 4 MB）" };
      const width = Math.min(Math.max(Number(fd.get("width")) || 1100, 50), 4000);
      const height = Math.min(Math.max(Number(fd.get("height")) || 825, 50), 4000);
      const path = `${section}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const image_url = await sbUpload(PHOTO_BUCKET, path, file, file.type);
      upload = { image_url, storage_path: path, width, height };
    }

    const fields = { section, title, tag, body, color, published };
    if (id) {
      const old = (await sbGet<SitePhoto[]>(`site_photos?id=eq.${id}&select=*`))[0];
      if (!old) return { ok: false, message: "找不到這張照片" };
      await sbPatch(`site_photos?id=eq.${id}`, { ...fields, ...(upload ?? {}) });
      if (upload && old.storage_path) await sbRemoveFile(PHOTO_BUCKET, old.storage_path); // 換圖後刪掉舊檔
      await audit(actorOf(staff), "site_photo.update", `site_photos:${id}`, { title, replacedImage: !!upload, published });
      refresh();
      return { ok: true, message: upload ? "已更換照片並儲存" : "已儲存" };
    }

    if (!upload) return { ok: false, message: "請選一張照片" };
    const last = await sbGet<{ sort: number }[]>(`site_photos?section=eq.${section}&select=sort&order=sort.desc&limit=1`);
    const row = await sbInsert<SitePhoto>("site_photos", { ...fields, ...upload, sort: (last[0]?.sort ?? 0) + 1, created_by: staff.id });
    await audit(actorOf(staff), "site_photo.create", `site_photos:${row?.id ?? ""}`, { section, title });
    refresh();
    return { ok: true, message: "已新增照片" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "儲存失敗" };
  }
}

// 調整順序：和上一張／下一張交換位置
export async function movePhoto(id: string, dir: "up" | "down"): Promise<PhotoResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id)) return { ok: false, message: "資料不正確" };
  const me = (await sbGet<SitePhoto[]>(`site_photos?id=eq.${id}&select=id,section`))[0];
  if (!me) return { ok: false, message: "找不到這張照片" };
  const list = await sbGet<{ id: string; sort: number }[]>(`site_photos?section=eq.${me.section}&select=id,sort&order=sort,created_at`);
  const i = list.findIndex((p) => p.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true, message: "" };
  [list[i], list[j]] = [list[j], list[i]];
  // 重新編號 1、2、3…，避免順序值重複
  await Promise.all(list.map((p, k) => (p.sort === k + 1 ? null : sbPatch(`site_photos?id=eq.${p.id}`, { sort: k + 1 }))));
  await audit(actorOf(staff), "site_photo.move", `site_photos:${id}`, { dir });
  refresh();
  return { ok: true, message: "" };
}

export async function deletePhoto(id: string): Promise<PhotoResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id)) return { ok: false, message: "資料不正確" };
  const old = (await sbGet<SitePhoto[]>(`site_photos?id=eq.${id}&select=*`))[0];
  if (!old) return { ok: true, message: "已刪除" };
  await sbDelete(`site_photos?id=eq.${id}`);
  if (old.storage_path) await sbRemoveFile(PHOTO_BUCKET, old.storage_path);
  await audit(actorOf(staff), "site_photo.delete", `site_photos:${id}`, { title: old.title, section: old.section });
  refresh();
  return { ok: true, message: "已刪除" };
}

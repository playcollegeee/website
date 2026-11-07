"use client";

import { shrinkImage } from "@/lib/imageShrink";
import { uploadLessonModel, uploadLessonPhoto, type FileResult } from "./fileActions";

export const isImageFile = (f: File) => /\.(png|jpe?g|webp)$/i.test(f.name) || /^image\/(png|jpeg|webp)$/.test(f.type);
export const isIoFile = (f: File) => /\.io$/i.test(f.name);

// 上傳一張照片：大圖最長邊 1600、縮圖 480，都在瀏覽器先處理好
export async function sendPhoto(lessonId: string, file: File): Promise<FileResult> {
  try {
    const big = await shrinkImage(file, 1600, 0.85);
    const thumb = await shrinkImage(file, 480, 0.8);
    const fd = new FormData();
    fd.set("lesson_id", lessonId);
    fd.set("file", big.blob, file.name);
    fd.set("thumb", thumb.blob, file.name);
    fd.set("width", String(big.width));
    fd.set("height", String(big.height));
    fd.set("name", file.name);
    return await uploadLessonPhoto(fd);
  } catch (e) {
    return { ok: false, message: `${file.name}：${e instanceof Error ? e.message : "上傳失敗"}` };
  }
}

export async function sendModel(lessonId: string, file: File): Promise<FileResult> {
  try {
    if (file.size > 4 * 1024 * 1024) return { ok: false, message: `${file.name}：檔案太大（上限 4 MB）` };
    const fd = new FormData();
    fd.set("lesson_id", lessonId);
    fd.set("file", file, file.name);
    return await uploadLessonModel(fd);
  } catch (e) {
    return { ok: false, message: `${file.name}：${e instanceof Error ? e.message : "上傳失敗"}` };
  }
}

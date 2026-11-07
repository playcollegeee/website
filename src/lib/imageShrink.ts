// 瀏覽器端縮圖：手機照片、BrickLink 算圖常常 3–12 MB，先縮小再上傳（只能在瀏覽器裡用）
export type Shrunk = { blob: Blob; width: number; height: number };

export async function shrinkImage(file: Blob, maxSide: number, quality = 0.85): Promise<Shrunk> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("這個檔案讀不出來，請改用 JPG 或 PNG（iPhone 的 HEIC 請先轉檔或用截圖）");
  }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const width = Math.max(1, Math.round(bmp.width * scale));
  const height = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  // 透明背景（BrickLink 算圖的 PNG）補白底，轉成 JPEG 時才不會變黑
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const toBlob = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg"); // 舊版 Safari 不支援 WebP
  if (!blob) throw new Error("照片處理失敗，請換一張試試");
  return { blob, width, height };
}

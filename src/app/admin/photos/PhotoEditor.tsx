"use client";

import { useRef, useState, useTransition } from "react";
import type { PhotoSection, SitePhoto } from "@/lib/sitePhotos";
import type { PhotoResult } from "./actions";

const COLORS = [
  { value: "red", label: "紅" },
  { value: "green", label: "綠" },
  { value: "blue", label: "藍" },
  { value: "yellow", label: "黃" },
];
const MAX_SIDE = 1600; // 縮圖後最長邊

// 在瀏覽器先把照片縮小（手機照片常常 5–10 MB），再上傳
async function shrink(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("這個檔案讀不出來，請改用 JPG 或 PNG（iPhone 的 HEIC 請先轉檔或用截圖）");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  let blob = await toBlob("image/webp", 0.85);
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg", 0.85); // 舊版 Safari 不支援 WebP
  if (!blob) throw new Error("照片處理失敗，請換一張試試");
  return { blob, width, height };
}

export default function PhotoEditor({
  section,
  photo,
  save,
  move,
  remove,
  isFirst,
  isLast,
}: {
  section: PhotoSection;
  photo?: SitePhoto;
  save: (fd: FormData) => Promise<PhotoResult>;
  move?: (id: string, dir: "up" | "down") => Promise<PhotoResult>;
  remove?: (id: string) => Promise<PhotoResult>;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<{ blob: Blob; width: number; height: number; url: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, start] = useTransition();
  const isNew = !photo;
  const preview = img?.url ?? photo?.image_url;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setMsg(null);
    try {
      const out = await shrink(f);
      if (img) URL.revokeObjectURL(img.url);
      setImg({ ...out, url: URL.createObjectURL(out.blob) });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "照片處理失敗" });
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("picker");
    if (img) {
      fd.set("file", img.blob, `photo.${img.blob.type === "image/webp" ? "webp" : "jpg"}`);
      fd.set("width", String(img.width));
      fd.set("height", String(img.height));
    }
    start(async () => {
      const r = await save(fd);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) {
        if (img) URL.revokeObjectURL(img.url);
        setImg(null);
        if (fileRef.current) fileRef.current.value = "";
        if (isNew) formRef.current?.reset();
      }
    });
  }

  function run(fn: () => Promise<PhotoResult>) {
    start(async () => {
      const r = await fn();
      if (r.message) setMsg({ ok: r.ok, text: r.message });
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className={`ph-card ${isNew ? "ph-new" : ""} ${photo && !photo.published ? "ph-hidden" : ""}`} aria-busy={busy}>
      {photo && <input type="hidden" name="id" value={photo.id} />}
      <input type="hidden" name="section" value={section} />

      <label className="ph-img">
        {preview ? <img src={preview} alt="" /> : <span className="ph-empty">＋ 選一張照片</span>}
        <span className="ph-img-btn">{preview ? (isNew ? "換一張" : "更換照片") : "選擇照片"}</span>
        <input ref={fileRef} type="file" name="picker" accept="image/*" onChange={pick} className="sr-only" />
      </label>
      {img && <p className="hint">已縮小為 {img.width}×{img.height}（{Math.round(img.blob.size / 1024)} KB），按「儲存」才會上傳。</p>}

      <div className="ph-fields">
        {section === "highlights" ? (
          <>
            <label>
              時間標籤
              <input name="tag" defaultValue={photo?.tag ?? ""} placeholder="例：2026・夏" maxLength={30} />
            </label>
            <label>
              標題
              <input name="title" defaultValue={photo?.title ?? ""} placeholder="例：飆速遙控計畫" maxLength={80} required />
            </label>
            <label className="ph-wide">
              介紹（一兩句）
              <textarea name="body" defaultValue={photo?.body ?? ""} rows={3} maxLength={300} placeholder="孩子們做了什麼、學到什麼" />
            </label>
            <label>
              卡片顏色
              <select name="color" defaultValue={photo?.color ?? "red"}>
                {COLORS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <label className="ph-wide">
            照片說明
            <input name="title" defaultValue={photo?.title ?? ""} placeholder="例：積木故事屋：小小釣手" maxLength={80} required />
          </label>
        )}
        <label className="ph-check">
          <input type="checkbox" name="published" defaultChecked={photo?.published ?? true} />
          顯示在官網
        </label>
      </div>

      <div className="ph-actions">
        <button type="submit" className="btn btn-sm primary" disabled={busy}>
          {busy ? "處理中…" : isNew ? "新增" : "儲存"}
        </button>
        {photo && move && (
          <>
            <button type="button" className="btn btn-sm" disabled={busy || isFirst} onClick={() => run(() => move(photo.id, "up"))} aria-label="往前移">↑</button>
            <button type="button" className="btn btn-sm" disabled={busy || isLast} onClick={() => run(() => move(photo.id, "down"))} aria-label="往後移">↓</button>
          </>
        )}
        {photo && remove && (
          confirmDel ? (
            <>
              <button type="button" className="btn btn-sm ph-danger" disabled={busy} onClick={() => run(() => remove(photo.id))}>確定刪除</button>
              <button type="button" className="adm-link" onClick={() => setConfirmDel(false)}>取消</button>
            </>
          ) : (
            <button type="button" className="adm-link ph-del" onClick={() => setConfirmDel(true)}>刪除</button>
          )
        )}
        {msg && <span className={`ph-msg ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</span>}
      </div>
    </form>
  );
}

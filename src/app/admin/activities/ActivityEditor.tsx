"use client";

import { useRef, useState, useTransition } from "react";
import { AUDIENCE_LABEL, KIND_LABEL, type Activity } from "@/lib/activityTypes";
import { shrinkImage } from "@/lib/imageShrink";
import type { ActResult } from "./actions";

// 後台：一張活動卡片的新增／編輯表單（照片在瀏覽器先縮到 1600px 再上傳）
export default function ActivityEditor({
  activity,
  save,
  move,
  remove,
  isFirst,
  isLast,
}: {
  activity?: Activity;
  save: (fd: FormData) => Promise<ActResult>;
  move?: (id: string, dir: "up" | "down") => Promise<ActResult>;
  remove?: (id: string) => Promise<ActResult>;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const a = activity;
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<{ blob: Blob; width: number; height: number; url: string } | null>(null);
  const [signup, setSignup] = useState(a?.signup ?? "contact");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, start] = useTransition();
  const isNew = !a;
  const preview = img?.url ?? a?.image_url ?? undefined;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setMsg(null);
    try {
      const out = await shrinkImage(f, 1600);
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
        if (isNew) {
          formRef.current?.reset();
          setSignup("contact");
        }
      }
    });
  }

  function run(fn: () => Promise<ActResult>) {
    start(async () => {
      const r = await fn();
      if (r.message) setMsg({ ok: r.ok, text: r.message });
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className={`ph-card act-edit ${isNew ? "ph-new" : ""} ${a && !a.published ? "ph-hidden" : ""}`} aria-busy={busy}>
      {a && <input type="hidden" name="id" value={a.id} />}

      <label className="ph-img">
        {preview ? <img src={preview} alt="" /> : <span className="ph-empty">＋ 選一張照片（可不放）</span>}
        <span className="ph-img-btn">{preview ? "更換照片" : "選擇照片"}</span>
        <input ref={fileRef} type="file" name="picker" accept="image/*" onChange={pick} className="sr-only" />
      </label>
      {img && <p className="hint">已縮小為 {img.width}×{img.height}（{Math.round(img.blob.size / 1024)} KB），按「儲存」才會上傳。</p>}

      <div className="ph-fields">
        <label className="ph-wide">
          活動名稱
          <input name="title" defaultValue={a?.title ?? ""} placeholder="例：樂高療癒班" maxLength={60} required />
        </label>
        <label>
          對象
          <select name="audience" defaultValue={a?.audience ?? "kids"}>
            {Object.entries(AUDIENCE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label>
          類型
          <select name="kind" defaultValue={a?.kind ?? "workshop"}>
            {Object.entries(KIND_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label className="ph-wide">
          適合對象說明
          <input name="audience_text" defaultValue={a?.audience_text ?? ""} placeholder="例：國小三年級以上，也歡迎大人一起參加" maxLength={80} />
        </label>
        <label className="ph-wide">
          介紹
          <textarea name="summary" defaultValue={a?.summary ?? ""} rows={3} maxLength={600} placeholder="做什麼、會帶走什麼、適合誰" />
        </label>
        <label className="ph-wide">
          小標籤（用逗號或頓號分開，最多 6 個）
          <input name="tags" defaultValue={a?.tags.join("、") ?? ""} placeholder="例：半日體驗、帶回作品" maxLength={200} />
        </label>
        <label>
          時間（可不填）
          <input name="schedule_text" defaultValue={a?.schedule_text ?? ""} placeholder="例：每月第二個週六 10:00" maxLength={120} />
        </label>
        <label>
          費用（定案後再填，空白不顯示）
          <input name="price_text" defaultValue={a?.price_text ?? ""} placeholder="例：每人 $800，含材料" maxLength={80} />
        </label>
        <label>
          報名按鈕
          <select name="signup" value={signup} onChange={(e) => setSignup(e.target.value as Activity["signup"])}>
            <option value="contact">帶到官網詢問表單（自動填好活動名稱）</option>
            <option value="link">外部報名連結（例：Google 表單、合作單位報名頁）</option>
            <option value="none">不顯示報名按鈕</option>
          </select>
        </label>
        {signup === "link" && (
          <label>
            外部報名連結
            <input name="signup_url" type="url" defaultValue={a?.signup_url ?? ""} placeholder="https://…" maxLength={300} required />
          </label>
        )}
        <label className="ph-check">
          <input type="checkbox" name="published" defaultChecked={a?.published ?? true} />
          顯示在官網
        </label>
      </div>

      <div className="ph-actions">
        <button type="submit" className="btn btn-sm primary" disabled={busy}>
          {busy ? "處理中…" : isNew ? "新增" : "儲存"}
        </button>
        {a && move && (
          <>
            <button type="button" className="btn btn-sm" disabled={busy || isFirst} onClick={() => run(() => move(a.id, "up"))} aria-label="往前移">↑</button>
            <button type="button" className="btn btn-sm" disabled={busy || isLast} onClick={() => run(() => move(a.id, "down"))} aria-label="往後移">↓</button>
          </>
        )}
        {a && remove &&
          (confirmDel ? (
            <>
              <button type="button" className="btn btn-sm ph-danger" disabled={busy} onClick={() => run(() => remove(a.id))}>確定刪除</button>
              <button type="button" className="adm-link" onClick={() => setConfirmDel(false)}>取消</button>
            </>
          ) : (
            <button type="button" className="adm-link ph-del" onClick={() => setConfirmDel(true)}>刪除</button>
          ))}
        {msg && <span className={`ph-msg ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</span>}
      </div>
    </form>
  );
}

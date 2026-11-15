"use client";

import { useRef, useState, useTransition } from "react";
import { shrinkImage } from "@/lib/imageShrink";
import type { CampPhoto } from "@/lib/campTypes";
import ConfirmButton from "../../ConfirmButton";
import { addSeasonPhoto, deleteSeasonPhoto } from "../actions";

// 營隊照片：可一次選多張，瀏覽器先縮到 1600px 再逐張上傳
export default function PhotoManager({ seasonId, photos }: { seasonId: string; photos: CampPhoto[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  function upload(files: FileList | null) {
    if (!files?.length) return;
    start(async () => {
      let n = 0;
      for (const f of [...files].slice(0, 12)) {
        try {
          const out = await shrinkImage(f, 1600);
          const fd = new FormData();
          fd.set("id", seasonId);
          fd.set("file", out.blob, `photo.${out.blob.type === "image/webp" ? "webp" : "jpg"}`);
          fd.set("width", String(out.width));
          fd.set("height", String(out.height));
          const r = await addSeasonPhoto(fd);
          if (!r.ok) {
            setMsg({ ok: false, text: r.message });
            break;
          }
          n++;
          setMsg({ ok: true, text: `已上傳 ${n} 張…` });
        } catch (e) {
          setMsg({ ok: false, text: e instanceof Error ? e.message : "上傳失敗" });
          break;
        }
      }
      if (n) setMsg({ ok: true, text: `已上傳 ${n} 張` });
      if (ref.current) ref.current.value = "";
    });
  }

  return (
    <div className="adm-panel">
      <div className="cmp-photos">
        {photos.map((p) => (
          <figure key={p.url}>
            <img src={p.url} alt="" loading="lazy" />
            <ConfirmButton label="刪除" message="刪除這張照片？" onConfirm={() => start(async () => {
              const r = await deleteSeasonPhoto(seasonId, p.url);
              setMsg({ ok: r.ok, text: r.message });
            })} />
          </figure>
        ))}
      </div>
      <label className="btn btn-sm">
        {busy ? "上傳中…" : "＋ 選照片（可一次多張）"}
        <input ref={ref} type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files)} />
      </label>
      {msg && <span className={`ph-msg ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</span>}
    </div>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import ConfirmButton from "@/app/admin/ConfirmButton";
import { useRouter } from "next/navigation";
import { fmtBytes } from "@/lib/lessons";
import { deleteLessonFile, setLessonCover, type FileResult } from "./fileActions";
import { isImageFile, isIoFile, sendModel, sendPhoto } from "./uploadClient";

export type Photo = { id: string; thumb: string | null; full: string | null; name: string; is_cover: boolean; canManage: boolean };
export type Model = { id: string; name: string; size: number | null; canManage: boolean };

// 教案頁的照片牆與組裝圖檔（.io）：所有老師都能上傳；刪除、換封面限上傳者／作者／管理員
export default function LessonFiles({
  lessonId, photos, models,
}: {
  lessonId: string;
  photos: Photo[];
  models: Model[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msgs, setMsgs] = useState<FileResult[]>([]);
  const [view, setView] = useState<Photo | null>(null);
  const [, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const ioInput = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null, kind: "photo" | "io") {
    if (!files?.length) return;
    const list = [...files].filter(kind === "photo" ? isImageFile : isIoFile);
    const out: FileResult[] = [];
    if (list.length < files.length) out.push({ ok: false, message: kind === "photo" ? "已略過不是 JPG／PNG／WebP 的檔案" : "已略過不是 .io 的檔案" });
    for (let i = 0; i < list.length; i++) {
      setBusy(`上傳中 ${i + 1}／${list.length}：${list[i].name}`);
      out.push(await (kind === "photo" ? sendPhoto(lessonId, list[i]) : sendModel(lessonId, list[i])));
    }
    setBusy("");
    setMsgs(out.filter((m) => !m.ok || list.length <= 3));
    if (photoInput.current) photoInput.current.value = "";
    if (ioInput.current) ioInput.current.value = "";
    start(() => router.refresh());
  }

  function act(fn: (fd: FormData) => Promise<FileResult>, id: string) {
    const fd = new FormData();
    fd.set("id", id);
    setBusy("處理中…");
    start(async () => {
      const r = await fn(fd);
      setBusy("");
      setMsgs([r]);
      router.refresh();
    });
  }

  const open = (p: Photo) => {
    setView(p);
    dialog.current?.showModal();
  };

  return (
    <>
      <section className="adm-panel">
        <h2>成品照片 <small>{photos.length} 張</small></h2>
        {photos.length === 0 ? (
          <p className="adm-empty">還沒有照片。上傳成品照片後，教案庫列表就會顯示封面。</p>
        ) : (
          <ul className="lsn-photos">
            {photos.map((p) => (
              <li key={p.id} className={p.is_cover ? "is-cover" : ""}>
                <button type="button" className="lsn-photo-btn" onClick={() => open(p)} aria-label={`放大 ${p.name}`}>
                  {p.thumb ? <img src={p.thumb} alt={p.name} loading="lazy" /> : <span>無法顯示</span>}
                </button>
                {p.is_cover && <span className="lsn-cover-badge">封面</span>}
                {p.canManage && (
                  <span className="lsn-photo-acts lsn-noprint">
                    {!p.is_cover && <button type="button" className="adm-link" onClick={() => act(setLessonCover, p.id)}>設為封面</button>}
                    <ConfirmButton label="刪除" message="確定刪除這張照片？" onConfirm={() => act(deleteLessonFile, p.id)} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="lsn-upload lsn-noprint">
          <label className="btn btn-sm">
            ＋ 上傳照片
            <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden disabled={!!busy}
              onChange={(e) => upload(e.target.files, "photo")} />
          </label>
          <small className="hint">可一次選多張；會自動縮小。請上傳作品照片，避免拍到孩子的臉。</small>
        </div>
      </section>

      <section className="adm-panel">
        <h2>組裝圖檔（.io） <small>{models.length} 個</small></h2>
        {models.length > 0 && (
          <ul className="lsn-models">
            {models.map((m) => (
              <li key={m.id}>
                <a href={`/admin/lessons/file/${m.id}`} className="lsn-model-link">🧱 {m.name}</a>
                <small>{fmtBytes(m.size)}</small>
                {m.canManage && (
                  <span className="lsn-noprint"><ConfirmButton label="刪除" message={`確定刪除 ${m.name}？`} onConfirm={() => act(deleteLessonFile, m.id)} /></span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="lsn-upload lsn-noprint">
          <label className="btn btn-sm">
            ＋ 上傳 .io
            <input ref={ioInput} type="file" accept=".io" multiple hidden disabled={!!busy}
              onChange={(e) => upload(e.target.files, "io")} />
          </label>
          <small className="hint">BrickLink Studio 的組裝檔，下載後用 Studio 開啟。</small>
        </div>
      </section>

      {(busy || msgs.length > 0) && (
        <div className="lsn-upload-status" role="status" aria-live="polite">
          {busy && <p>{busy}</p>}
          {!busy && msgs.map((m, i) => <p key={i} className={m.ok ? "" : "err"}>{m.ok ? "✓" : "⚠"} {m.message}</p>)}
        </div>
      )}

      <dialog ref={dialog} className="lsn-lightbox" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        {view && (
          <figure>
            {view.full ? <img src={view.full} alt={view.name} /> : <p>無法顯示</p>}
            <figcaption>
              {view.name}
              <span>
                <a href={`/admin/lessons/file/${view.id}`} className="adm-link">下載原檔</a>
                <button type="button" className="adm-link" onClick={() => dialog.current?.close()}>關閉</button>
              </span>
            </figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}

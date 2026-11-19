"use client";

import { useRef, useState, useTransition } from "react";
import ConfirmButton from "@/app/admin/ConfirmButton";
import { who } from "@/lib/plans";
import { REF_MAX_BYTES, REF_MAX_FILES, fileIcon, fmtSize, type PlanRef } from "@/lib/planRefs";
import { addRefLink, deleteRef, finishRefUpload, startRefUpload } from "./refActions";

// 參考網址及檔案（2026-11-19）：會議室放在白板下方（記在這場會議）；規劃頁放在討論下方，列出所有會議的資料。
// 檔案直接從瀏覽器上傳到 Supabase 私人空間，打開時由伺服器給 60 秒有效的連結。
export default function Refs({
  planId, meetingId, refs, me, isAdmin, canEditPlan, showMeeting,
}: {
  planId: string; meetingId?: string; refs: PlanRef[]; me: string; isAdmin: boolean; canEditPlan: boolean;
  showMeeting?: boolean; // 規劃頁：每筆標出是哪場會議貼的
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [busy, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const canDelete = (r: PlanRef) => isAdmin || canEditPlan || r.created_by === me;

  const addLink = () =>
    start(async () => {
      const r = await addRefLink({ planId, meetingId, url, title });
      setMsg(r.ok ? null : { ok: false, text: r.message });
      if (r.ok) { setUrl(""); setTitle(""); }
    });

  // 用 XMLHttpRequest 才看得到上傳進度
  const put = (target: string, file: File, onPct: (n: number) => void) =>
    new Promise<void>((ok, bad) => {
      const x = new XMLHttpRequest();
      x.open("PUT", target);
      x.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      x.setRequestHeader("x-upsert", "false");
      x.upload.onprogress = (e) => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)); };
      x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : bad(new Error(`上傳失敗（${x.status}）`)));
      x.onerror = () => bad(new Error("網路中斷，上傳失敗"));
      x.send(file);
    });

  const upload = async (list: FileList | File[]) => {
    const files = [...list];
    if (!files.length) return;
    if (files.length > REF_MAX_FILES) { setMsg({ ok: false, text: `一次最多 ${REF_MAX_FILES} 個檔案` }); return; }
    const big = files.find((f) => f.size > REF_MAX_BYTES);
    if (big) { setMsg({ ok: false, text: `「${big.name}」超過 ${REF_MAX_BYTES / 1024 / 1024} MB，請先壓縮，或上傳到雲端硬碟後改貼連結` }); return; }
    setMsg(null);
    let done = 0;
    const errors: string[] = [];
    for (const [i, f] of files.entries()) {
      const label = files.length > 1 ? `（${i + 1}/${files.length}）` : "";
      setProgress(`上傳中${label}：${f.name} 0%`);
      try {
        const s = await startRefUpload({ planId, name: f.name, size: f.size });
        if (!s.ok || !s.url || !s.path) throw new Error(s.message);
        await put(s.url, f, (n) => setProgress(`上傳中${label}：${f.name} ${n}%`));
        const r = await finishRefUpload({ planId, meetingId, path: s.path, name: f.name, size: f.size, mime: f.type });
        if (!r.ok) throw new Error(r.message);
        done += 1;
      } catch (e) {
        errors.push(`${f.name}：${e instanceof Error ? e.message : "上傳失敗"}`);
      }
    }
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    setMsg(errors.length ? { ok: false, text: errors.join("；") } : { ok: true, text: `已上傳 ${done} 個檔案` });
  };

  return (
    <div className={`pln-refs${over ? " over" : ""}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!progress) void upload(e.dataTransfer.files); }}>
      {refs.length === 0 ? (
        <p className="muted">還沒有資料。貼上參考網址，或上傳檔案（也可以直接把檔案拖進這一區）。</p>
      ) : (
        <ul className="pln-ref-list">
          {refs.map((r) => (
            <li key={r.id} className="pln-ref">
              <span className="pln-ref-icon" aria-hidden>{r.kind === "link" ? "🔗" : fileIcon(r.file_name)}</span>
              <span className="pln-ref-main">
                {r.kind === "link" ? (
                  <a href={r.url!} target="_blank" rel="noopener noreferrer nofollow">{r.title || r.url}</a>
                ) : (
                  <a href={`/admin/plans/refs/${r.id}`} target="_blank" rel="noopener">{r.title || r.file_name}</a>
                )}
                <small className="muted">
                  {r.kind === "link" && r.title ? `${r.url!.replace(/^https?:\/\//, "").slice(0, 50)}・` : ""}
                  {r.kind === "file" && r.title ? `${r.file_name}・` : ""}
                  {r.kind === "file" && r.file_size ? `${fmtSize(r.file_size)}・` : ""}
                  {who(r.author ?? null)}・{new Date(r.created_at).toLocaleDateString("zh-TW")}
                  {showMeeting && r.meeting ? `・${r.meeting.title}` : ""}
                </small>
              </span>
              <span className="pln-ref-tools">
                {r.kind === "file" && <a className="adm-link" href={`/admin/plans/refs/${r.id}?dl=1`}>下載</a>}
                {canDelete(r) && (
                  <ConfirmButton label="✕" ariaLabel="刪除" disabled={busy} confirmLabel="刪除"
                    message={r.kind === "file" ? `刪除「${r.file_name}」？檔案會一起刪掉。` : "刪除這個網址？"}
                    onConfirm={() => start(async () => { const x = await deleteRef(r.id); setMsg(x.ok ? null : { ok: false, text: x.message }); })} />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="pln-ref-new">
        <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={2000} placeholder="貼上網址，例：https://…" aria-label="參考網址"
          onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) { e.preventDefault(); addLink(); } }} />
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="說明（選填）" aria-label="網址說明"
          onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) { e.preventDefault(); addLink(); } }} />
        <button type="button" className="btn btn-sm" disabled={busy || !url.trim()} onClick={addLink}>＋ 加入網址</button>
        <label className={`btn btn-sm pln-ref-file${progress ? " disabled" : ""}`}>
          📁 上傳檔案
          <input ref={fileRef} type="file" multiple hidden disabled={!!progress}
            onChange={(e) => { if (e.target.files) void upload(e.target.files); }} />
        </label>
      </div>
      <p className="hint">單檔 {REF_MAX_BYTES / 1024 / 1024} MB 以內，只有登入的老師打得開。影片等大檔案請上傳到雲端硬碟後貼連結。</p>
      {progress && <p className="notice ok" role="status">{progress}</p>}
      {msg && <p className={`notice ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</p>}
    </div>
  );
}

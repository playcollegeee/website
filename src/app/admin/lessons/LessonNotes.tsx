"use client";

import { useState, useTransition } from "react";
import { NOTE_KINDS, type LessonNote, type NoteKind } from "@/lib/lessons";
import { addNote, deleteNote, updateNote } from "./noteActions";
import Text from "./LessonText";

const fmt = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};
const who = (n: LessonNote) => (n.author ? n.author.nickname || n.author.name : "舊資料");

// 教案頁的「參考資料」「參考進行活動」：大家一起累積
export default function LessonNotes({
  lessonId, kind, notes, me, isAdmin,
}: {
  lessonId: string;
  kind: NoteKind;
  notes: LessonNote[];
  me: string;
  isAdmin: boolean;
}) {
  const meta = NOTE_KINDS.find((k) => k.value === kind)!;
  const [editing, setEditing] = useState<string | null>(null); // note id 或 "new"
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const canEdit = (n: LessonNote) => isAdmin || (!!n.author_id && n.author_id === me);

  const open = (n?: LessonNote) => {
    setMsg(null);
    setEditing(n ? n.id : "new");
    setBody(n?.body ?? "");
    setUrl(n?.url ?? "");
  };
  const save = () =>
    start(async () => {
      const r = editing === "new"
        ? await addNote({ lessonId, kind, body, url })
        : await updateNote({ id: editing!, body, url });
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) setEditing(null);
    });
  const remove = (n: LessonNote) => {
    if (!confirm(`確定刪除 ${who(n)} 寫的這筆${meta.label}？刪除後無法復原。`)) return;
    start(async () => {
      const r = await deleteNote(n.id);
      setMsg({ ok: r.ok, text: r.message });
    });
  };

  const editor = (
    <div className="lsn-note-edit lsn-noprint">
      <textarea rows={kind === "activity" ? 5 : 3} maxLength={3000} value={body} onChange={(e) => setBody(e.target.value)}
        placeholder={meta.placeholder} aria-label={meta.label} autoFocus />
      <input type="url" maxLength={500} value={url} onChange={(e) => setUrl(e.target.value)}
        placeholder="連結（選填，例如影片或網頁 https://…）" aria-label="連結" />
      <div className="adm-btns">
        <button type="button" className="btn btn-sm primary" onClick={save} disabled={busy || !body.trim()}>
          {busy ? "儲存中…" : editing === "new" ? "新增" : "儲存"}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setEditing(null)} disabled={busy}>取消</button>
      </div>
    </div>
  );

  return (
    <section className="adm-panel lsn-notes">
      <h2>{meta.icon} {meta.label} <small>{meta.hint}</small></h2>
      {notes.length === 0 && editing !== "new" && <p className="muted">還沒有人分享。</p>}
      <ul className="lsn-note-list">
        {notes.map((n) => (
          <li key={n.id} className="lsn-note">
            {editing === n.id ? editor : (
              <>
                <Text v={n.body} />
                {n.url && <p className="lsn-note-url"><a href={n.url} target="_blank" rel="noopener noreferrer">🔗 {n.url}</a></p>}
                <div className="lsn-note-meta">
                  <span>{who(n)}・{fmt(n.created_at)}{n.updated_at.slice(0, 16) !== n.created_at.slice(0, 16) ? "（已修改）" : ""}</span>
                  <span className="lsn-noprint">
                    {canEdit(n) && <button type="button" className="adm-link" onClick={() => open(n)} disabled={busy}>編輯</button>}
                    {isAdmin && <button type="button" className="adm-link danger" onClick={() => remove(n)} disabled={busy}>刪除</button>}
                  </span>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {editing === "new" ? editor : (
        <button type="button" className="btn btn-sm lsn-noprint" onClick={() => open()} disabled={busy}>＋ 新增{meta.label}</button>
      )}
      {msg && <p className={`notice ${msg.ok ? "ok" : "err"} lsn-noprint`} role="status">{msg.text}</p>}
    </section>
  );
}

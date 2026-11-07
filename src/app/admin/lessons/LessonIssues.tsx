"use client";

import { useState, useTransition } from "react";
import ConfirmButton from "@/app/admin/ConfirmButton";
import { noteAuthor, type LessonNote } from "@/lib/lessons";
import { addNote, addReply, deleteNote, updateNote } from "./noteActions";

const fmt = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

// 教案頁的「課程遇到的問題」：條列、顯示是誰寫的；每個問題底下老師可以留備註互相回饋解法
// 權限與參考資料相同：大家都能新增；只能改自己寫的；舊資料與別人寫的只有管理員能改；刪除只有管理員
export default function LessonIssues({
  lessonId, issues, replies, me, isAdmin,
}: {
  lessonId: string;
  issues: LessonNote[];
  replies: LessonNote[];
  me: string;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [newIssue, setNewIssue] = useState("");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const canEdit = (n: LessonNote) => isAdmin || (!!n.author_id && n.author_id === me);

  const run = (fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) after?.();
    });

  // 一則（問題或備註）的顯示＋編輯
  const Item = ({ n, isReply }: { n: LessonNote; isReply?: boolean }) =>
    editing === n.id ? (
      <div className="lsn-note-edit lsn-noprint">
        <textarea rows={isReply ? 2 : 2} maxLength={isReply ? 2000 : 500} value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus aria-label="內容" />
        <div className="adm-btns">
          <button type="button" className="btn btn-sm primary" disabled={busy || !editText.trim()}
            onClick={() => run(() => updateNote({ id: n.id, body: editText, url: "" }), () => setEditing(null))}>儲存</button>
          <button type="button" className="btn btn-sm" onClick={() => setEditing(null)} disabled={busy}>取消</button>
        </div>
      </div>
    ) : (
      <div className={isReply ? "lsn-reply" : "lsn-issue-body"}>
        <span className="lsn-issue-text">{isReply ? "↳ " : ""}{n.body}</span>
        <span className="lsn-note-meta">
          <span>{noteAuthor(n)}・{fmt(n.created_at)}</span>
          <span className="lsn-noprint">
            {canEdit(n) && (
              <button type="button" className="adm-link" disabled={busy} onClick={() => { setMsg(null); setEditing(n.id); setEditText(n.body); }}>編輯</button>
            )}
            {isAdmin && (
              <ConfirmButton label="刪除" disabled={busy}
                message={isReply ? "確定刪除這則備註？" : "確定刪除這個問題？底下的備註也會一起刪除，無法復原。"}
                onConfirm={() => run(() => deleteNote(n.id))} />
            )}
          </span>
        </span>
      </div>
    );

  return (
    <section className="adm-panel lsn-notes">
      <h2>⚠️ 課程遇到的問題 <small>孩子卡在哪、器材狀況、時間不夠…，其他老師可以留備註回饋解法</small></h2>
      {issues.length === 0 && <p className="muted">還沒有人記錄。</p>}
      <ul className="lsn-issues">
        {issues.map((n) => {
          const rs = replies.filter((r) => r.parent_id === n.id);
          return (
            <li key={n.id} className="lsn-issue">
              <Item n={n} />
              {rs.length > 0 && <ul className="lsn-replies">{rs.map((r) => <li key={r.id}><Item n={r} isReply /></li>)}</ul>}
              {replyFor === n.id ? (
                <div className="lsn-note-edit lsn-noprint">
                  <textarea rows={2} maxLength={2000} value={replyText} onChange={(e) => setReplyText(e.target.value)} autoFocus
                    placeholder="你的解法或建議，例：先讓孩子把軸插進黃色件再裝，比較省力" aria-label="備註" />
                  <div className="adm-btns">
                    <button type="button" className="btn btn-sm primary" disabled={busy || !replyText.trim()}
                      onClick={() => run(() => addReply({ issueId: n.id, body: replyText }), () => { setReplyFor(null); setReplyText(""); })}>
                      {busy ? "送出中…" : "送出備註"}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setReplyFor(null)} disabled={busy}>取消</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="adm-link lsn-noprint lsn-reply-btn" disabled={busy}
                  onClick={() => { setMsg(null); setReplyFor(n.id); setReplyText(""); }}>💬 留備註</button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="adm-inline-form lsn-noprint">
        <input value={newIssue} maxLength={500} onChange={(e) => setNewIssue(e.target.value)} className="lsn-full"
          placeholder="新增一個問題" aria-label="新增問題"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newIssue.trim()) {
              e.preventDefault();
              run(() => addNote({ lessonId, kind: "issue", body: newIssue, url: "" }), () => setNewIssue(""));
            }
          }} />
        <button type="button" className="btn btn-sm" disabled={busy || !newIssue.trim()}
          onClick={() => run(() => addNote({ lessonId, kind: "issue", body: newIssue, url: "" }), () => setNewIssue(""))}>＋ 新增</button>
      </div>
      {msg && <p className={`notice ${msg.ok ? "ok" : "err"} lsn-noprint`} role="status">{msg.text}</p>}
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import ConfirmButton from "@/app/admin/ConfirmButton";
import { who, type PlanComment } from "@/lib/plans";
import { addComment, deleteComment, editComment, toggleDecision } from "./actions";

const fmt = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// 留言串：一層回覆；留言可標成「決議」（限可修改規劃的人）；只能改自己的、刪除限管理員
export default function Discussion({
  planId, itemId, comments, me, isAdmin, canDecide, compact,
}: {
  planId: string;
  itemId?: string;
  comments: PlanComment[]; // 這個討論串的所有留言（含回覆）
  me: string;
  isAdmin: boolean;
  canDecide: boolean;
  compact?: boolean;
}) {
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? null : { ok: false, text: r.message });
      if (r.ok) after?.();
    });

  const tops = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  const One = ({ c, isReply }: { c: PlanComment; isReply?: boolean }) => (
    <div className={`pln-c${c.is_decision ? " decision" : ""}${isReply ? " reply" : ""}`}>
      <div className="pln-c-head">
        <strong>{who(c.author ?? null)}</strong>
        <small className="muted">{fmt(c.created_at)}{c.updated_at.slice(0, 16) !== c.created_at.slice(0, 16) ? "・已修改" : ""}</small>
        {c.is_decision && <span className="pln-badge decision">✅ 決議</span>}
      </div>
      {editing === c.id ? (
        <div className="pln-c-edit">
          <textarea rows={2} maxLength={3000} value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus aria-label="修改留言" />
          <div className="adm-btns">
            <button type="button" className="btn btn-sm primary" disabled={busy || !editText.trim()}
              onClick={() => run(() => editComment(c.id, editText), () => setEditing(null))}>儲存</button>
            <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>取消</button>
          </div>
        </div>
      ) : (
        <p className="pln-c-body">{c.body}</p>
      )}
      <div className="pln-c-tools">
        {!isReply && <button type="button" className="adm-link" onClick={() => { setReplyTo(c.id); setReply(""); }}>回覆</button>}
        {canDecide && (
          <button type="button" className="adm-link" disabled={busy} onClick={() => run(() => toggleDecision(c.id))}>
            {c.is_decision ? "取消決議" : "標為決議"}
          </button>
        )}
        {(isAdmin || c.author_id === me) && editing !== c.id && (
          <button type="button" className="adm-link" onClick={() => { setEditing(c.id); setEditText(c.body); }}>編輯</button>
        )}
        {isAdmin && (
          <ConfirmButton label="刪除" disabled={busy} message="確定刪除這則留言？回覆也會一起刪除。" onConfirm={() => run(() => deleteComment(c.id))} />
        )}
      </div>
    </div>
  );

  return (
    <div className={`pln-thread${compact ? " compact" : ""}`}>
      {tops.length === 0 && !compact && <p className="muted">還沒有留言，第一個說說想法吧。</p>}
      {tops.map((c) => (
        <div key={c.id} className="pln-c-wrap">
          <One c={c} />
          {repliesOf(c.id).map((r) => <One key={r.id} c={r} isReply />)}
          {replyTo === c.id && (
            <div className="pln-c-edit reply">
              <textarea rows={2} maxLength={3000} value={reply} onChange={(e) => setReply(e.target.value)} autoFocus
                placeholder={`回覆 ${who(c.author ?? null)}`} aria-label="回覆" />
              <div className="adm-btns">
                <button type="button" className="btn btn-sm primary" disabled={busy || !reply.trim()}
                  onClick={() => run(() => addComment({ planId, parentId: c.id, body: reply }), () => setReplyTo(null))}>送出</button>
                <button type="button" className="btn btn-sm" onClick={() => setReplyTo(null)}>取消</button>
              </div>
            </div>
          )}
        </div>
      ))}
      <div className="pln-c-new">
        <textarea rows={compact ? 1 : 2} maxLength={3000} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={itemId ? "針對這一項留言…" : "說說你的想法、提出問題或建議…"} aria-label="新留言"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && body.trim()) run(() => addComment({ planId, itemId, body }), () => setBody(""));
          }} />
        <button type="button" className="btn btn-sm primary" disabled={busy || !body.trim()}
          onClick={() => run(() => addComment({ planId, itemId, body }), () => setBody(""))}>
          {busy ? "送出中…" : "送出"}
        </button>
      </div>
      {msg && <p className="notice err" role="status">{msg.text}</p>}
    </div>
  );
}

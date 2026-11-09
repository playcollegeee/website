"use client";

import { useState, useTransition } from "react";
import { IDEA_KINDS, IDEA_KIND_LABEL, VOTES_PER_PLAN, who, type PlanComment, type PlanIdea } from "@/lib/plans";
import ConfirmButton from "@/app/admin/ConfirmButton";
import { addIdea, deleteIdea, editIdea, setIdeaStatus, toggleVote } from "./actions";
import Discussion from "./Discussion";

const STATUS_LABEL: Record<string, string> = { adopted: "✅ 已採用", dropped: "不採用" };

// 點子牆：老師各自貼點子（可匿名），每人最多 3 票，大家留意見，負責人採用（主題會直接填入規劃）
// 匿名點子在伺服器端就拿掉提案人資料，畫面上看不到是誰提的
export default function IdeaBoard({
  planId, ideas, comments, me, isAdmin, canEditPlan, hasTheme,
}: {
  planId: string;
  ideas: PlanIdea[];
  comments: PlanComment[];
  me: string;
  isAdmin: boolean;
  canEditPlan: boolean;
  hasTheme: boolean;
}) {
  const [f, setF] = useState({ kind: hasTheme ? "activity" : "theme", title: "", detail: "", anonymous: false });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [ef, setEf] = useState({ kind: "theme", title: "", detail: "", anonymous: false });
  const [talk, setTalk] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.message ? { ok: r.ok, text: r.message } : null);
      if (r.ok) after?.();
    });

  const used = ideas.filter((i) => i.votes?.some((v) => v.teacher_id === me)).length;
  const left = VOTES_PER_PLAN - used;
  const rank = (i: PlanIdea) => (i.status === "adopted" ? 1e6 : i.status === "dropped" ? -1e6 : 0) + (i.votes?.length ?? 0);
  const list = ideas.filter((i) => filter === "all" || i.kind === filter).sort((a, b) => rank(b) - rank(a) || a.created_at.localeCompare(b.created_at));

  return (
    <section className="adm-panel pln-ideas">
      <div className="pln-ideas-head">
        <h2>💡 點子牆 <small>{ideas.length} 個點子・你還有 {Math.max(0, left)}／{VOTES_PER_PLAN} 票</small></h2>
        <div className="pln-filter">
          {[{ value: "all", label: "全部" }, ...IDEA_KINDS].map((k) => (
            <button key={k.value} type="button" className={filter === k.value ? "on" : ""} onClick={() => setFilter(k.value)}>{k.label}</button>
          ))}
        </div>
      </div>
      <p className="hint">每個人先把想法貼上來，再用 👍 投票（每份規劃每人 {VOTES_PER_PLAN} 票，再按一次可以收回），覺得要補充的就留意見。負責老師選定後按「採用」，主題會直接填入這份規劃。</p>

      <div className="pln-idea-grid">
        {list.map((i) => {
          const votes = i.votes?.length ?? 0;
          const mine = !!i.votes?.some((v) => v.teacher_id === me);
          const isMine = i.author_id === me;
          const cs = comments.filter((c) => c.idea_id === i.id);
          return (
            <div key={i.id} className={`pln-idea ${i.kind} ${i.status}`}>
              {editing === i.id ? (
                <div className="pln-idea-form">
                  <select value={ef.kind} onChange={(e) => setEf({ ...ef, kind: e.target.value })} aria-label="種類">
                    {IDEA_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                  <input value={ef.title} maxLength={80} onChange={(e) => setEf({ ...ef, title: e.target.value })} aria-label="點子" />
                  <textarea rows={2} value={ef.detail} maxLength={1000} onChange={(e) => setEf({ ...ef, detail: e.target.value })} aria-label="說明" />
                  <label className="adm-check"><input type="checkbox" checked={ef.anonymous} onChange={(e) => setEf({ ...ef, anonymous: e.target.checked })} /> 匿名</label>
                  <div className="adm-btns">
                    <button type="button" className="btn btn-sm primary" disabled={busy || !ef.title.trim()} onClick={() => run(() => editIdea({ id: i.id, ...ef }), () => setEditing(null))}>儲存</button>
                    <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>取消</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="pln-idea-top">
                    <span className="pln-idea-kind">{IDEA_KIND_LABEL[i.kind]}</span>
                    {STATUS_LABEL[i.status] && <span className={`pln-badge ${i.status === "adopted" ? "final" : "idea"}`}>{STATUS_LABEL[i.status]}</span>}
                  </div>
                  <strong className="pln-idea-title">{i.title}</strong>
                  {i.detail && <p className="pln-idea-detail">{i.detail}</p>}
                  <small className="muted">{i.anonymous ? `匿名${isMine ? "（你）" : ""}` : who(i.author ?? null)}</small>
                  <div className="pln-idea-tools">
                    <button type="button" className={`pln-vote${mine ? " on" : ""}`} disabled={busy || i.status !== "open" || (!mine && left <= 0)}
                      title={i.status !== "open" ? "已經有結果" : mine ? "收回這一票" : left <= 0 ? "票數用完了，先收回一票" : "投一票"}
                      onClick={() => run(() => toggleVote(i.id))}>
                      👍 {votes}
                    </button>
                    <button type="button" className={`adm-link${cs.length ? " has" : ""}`} onClick={() => setTalk(talk === i.id ? null : i.id)}>💬 {cs.length || "意見"}</button>
                    {canEditPlan && i.status === "open" && (
                      <>
                        <button type="button" className="adm-link" disabled={busy} onClick={() => run(() => setIdeaStatus(i.id, "adopted"))}>
                          {i.kind === "theme" ? "採用為主題" : "採用"}
                        </button>
                        <button type="button" className="adm-link" disabled={busy} onClick={() => run(() => setIdeaStatus(i.id, "dropped"))}>不採用</button>
                      </>
                    )}
                    {canEditPlan && i.status !== "open" && (
                      <button type="button" className="adm-link" disabled={busy} onClick={() => run(() => setIdeaStatus(i.id, "open"))}>重新開放</button>
                    )}
                    {(isMine || isAdmin) && (
                      <>
                        {isMine && <button type="button" className="adm-link" onClick={() => { setEditing(i.id); setEf({ kind: i.kind, title: i.title, detail: i.detail ?? "", anonymous: i.anonymous }); }}>編輯</button>}
                        <ConfirmButton label="刪除" disabled={busy} message="確定刪除這個點子？投票和意見也會一起刪除。" onConfirm={() => run(() => deleteIdea(i.id))} />
                      </>
                    )}
                  </div>
                  {talk === i.id && (
                    <Discussion planId={planId} ideaId={i.id} comments={cs} me={me} isAdmin={isAdmin} canDecide={canEditPlan} compact />
                  )}
                </>
              )}
            </div>
          );
        })}
        {list.length === 0 && <p className="muted">還沒有點子，第一個貼上來吧！</p>}
      </div>

      {adding ? (
        <div className="pln-idea-form new">
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label="種類">
            {IDEA_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <input value={f.title} maxLength={80} autoFocus onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="點子"
            placeholder={f.kind === "theme" ? "例：恐龍探險隊" : "例：走讀去科博館，回來用樂高做恐龍骨架"} />
          <textarea rows={2} value={f.detail} maxLength={1000} onChange={(e) => setF({ ...f, detail: e.target.value })} aria-label="說明"
            placeholder="為什麼想做這個、可以延伸的課程或活動（選填）" />
          <label className="adm-check"><input type="checkbox" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} /> 匿名提出（大家看不到是誰提的）</label>
          <div className="adm-btns">
            <button type="button" className="btn btn-sm primary" disabled={busy || !f.title.trim()}
              onClick={() => run(() => addIdea({ planId, ...f }), () => { setF({ ...f, title: "", detail: "" }); setAdding(false); })}>貼上點子牆</button>
            <button type="button" className="btn btn-sm" onClick={() => setAdding(false)}>取消</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}>＋ 我有點子</button>
      )}
      {msg && <p className={`notice ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</p>}
    </section>
  );
}

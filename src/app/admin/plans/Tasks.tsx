"use client";

import Link from "next/link";
import ConfirmButton from "@/app/admin/ConfirmButton";
import { useState, useTransition } from "react";
import { PLAN_KIND_LABEL, fmtDay, who, type PlanTask } from "@/lib/plans";
import { addTask, deleteTask, toggleTask } from "./actions";

type T = { id: string; name: string; nickname: string | null };

// 待辦清單：指派老師與期限、勾選完成。showPlan＝在首頁「我的待辦」顯示來自哪份規劃
export default function Tasks({
  planId, tasks, teachers, me, isAdmin, canEditPlan, showPlan,
}: {
  planId?: string;
  tasks: PlanTask[];
  teachers?: T[];
  me: string;
  isAdmin: boolean;
  canEditPlan?: boolean;
  showPlan?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(me);
  const [due, setDue] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? null : r.message);
      if (r.ok) after?.();
    });
  const today = new Date().toISOString().slice(0, 10);
  const open = tasks.filter((t) => !t.done_at).sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const done = tasks.filter((t) => t.done_at);
  const canTick = (t: PlanTask) => t.assignee_id === me || t.created_by === me || !!canEditPlan || isAdmin;

  const Row = ({ t }: { t: PlanTask }) => (
    <li className={`pln-task${t.done_at ? " done" : ""}${!t.done_at && t.due_date && t.due_date < today ? " late" : ""}`}>
      <label className="adm-check">
        <input type="checkbox" checked={!!t.done_at} disabled={busy || !canTick(t)} onChange={() => run(() => toggleTask(t.id))} />
        <span>{t.title}</span>
      </label>
      <small className="muted">
        {showPlan && t.plan && <><Link href={`/admin/plans/${t.plan.id}`}>{PLAN_KIND_LABEL[t.plan.kind]}・{t.plan.title}</Link>{t.due_date ? "・" : ""}</>}
        {!showPlan && (t.assignee_id ? who(t.assignee ?? null) : "未指派")}
        {t.due_date && `${showPlan ? "" : "・"}${fmtDay(t.due_date)}前`}
        {!t.done_at && t.due_date && t.due_date < today && " ⚠️ 已過期"}
      </small>
      {!showPlan && (isAdmin || t.created_by === me) && (
        <ConfirmButton label="✕" ariaLabel="刪除待辦" disabled={busy} message="刪除這個待辦？" confirmLabel="刪除" onConfirm={() => run(() => deleteTask(t.id))} />
      )}
    </li>
  );

  return (
    <div className="pln-tasks">
      {open.length === 0 && <p className="muted">{showPlan ? "目前沒有指派給你的待辦。" : "沒有未完成的待辦。"}</p>}
      <ul>{open.map((t) => <Row key={t.id} t={t} />)}</ul>
      {done.length > 0 && (
        <button type="button" className="adm-link" onClick={() => setShowDone((v) => !v)}>
          {showDone ? "隱藏" : "顯示"}已完成（{done.length}）
        </button>
      )}
      {showDone && <ul>{done.map((t) => <Row key={t.id} t={t} />)}</ul>}
      {planId && teachers && (
        <div className="pln-task-new">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="新增待辦，例：確認走讀場地與日期" aria-label="待辦事項"
            onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) { e.preventDefault(); run(() => addTask({ planId, title, assigneeId: assignee, due }), () => { setTitle(""); setDue(""); }); } }} />
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="指派給">
            <option value="">未指派</option>
            {teachers.map((x) => <option key={x.id} value={x.id}>{x.nickname || x.name}</option>)}
          </select>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="期限" />
          <button type="button" className="btn btn-sm" disabled={busy || !title.trim()}
            onClick={() => run(() => addTask({ planId, title, assigneeId: assignee, due }), () => { setTitle(""); setDue(""); })}>＋ 新增</button>
        </div>
      )}
      {msg && <p className="notice err" role="status">{msg}</p>}
    </div>
  );
}

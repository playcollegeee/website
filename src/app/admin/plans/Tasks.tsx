"use client";

import Link from "next/link";
import ConfirmButton from "@/app/admin/ConfirmButton";
import { useState, useTransition } from "react";
import { PLAN_KIND_LABEL, fmtDay, namesOf, taskAssignees, who, type PlanTask } from "@/lib/plans";
import Linkify from "@/components/Linkify";
import { addTask, deleteTask, setTaskAssignees, toggleTask } from "./actions";
import TeacherPicks from "./TeacherPicks";

type T = { id: string; name: string; nickname: string | null };

// 待辦清單：指派老師與期限、勾選完成。showPlan＝在首頁「我的待辦」顯示來自哪份規劃
export default function Tasks({
  planId, tasks, teachers, me, isAdmin, canEditPlan, showPlan, meetingId, emptyText,
}: {
  planId?: string;
  meetingId?: string; // 在會議室新增的待辦記成這場會議的
  emptyText?: string;
  tasks: PlanTask[];
  teachers?: T[];
  me: string;
  isAdmin: boolean;
  canEditPlan?: boolean;
  showPlan?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [assignees, setAssignees] = useState<string[]>([me]);
  const [picking, setPicking] = useState(false); // 新增時展開選老師
  const [editWho, setEditWho] = useState<string | null>(null); // 正在改哪個待辦的負責老師
  const [editIds, setEditIds] = useState<string[]>([]);
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
  const canTick = (t: PlanTask) => taskAssignees(t).includes(me) || t.created_by === me || !!canEditPlan || isAdmin;
  const canReassign = (t: PlanTask) => t.created_by === me || !!canEditPlan || isAdmin;
  const whoText = (t: PlanTask) => {
    const ids = taskAssignees(t);
    if (!ids.length) return "未指派";
    return teachers ? namesOf(ids, teachers, t.assignee ?? null) : who(t.assignee ?? null) + (ids.length > 1 ? ` 等 ${ids.length} 位` : "");
  };

  const Row = ({ t }: { t: PlanTask }) => (
    <li className={`pln-task${t.done_at ? " done" : ""}${!t.done_at && t.due_date && t.due_date < today ? " late" : ""}`}>
      <label className="adm-check">
        <input type="checkbox" checked={!!t.done_at} disabled={busy || !canTick(t)} onChange={() => run(() => toggleTask(t.id))} />
        <span><Linkify text={t.title} /></span>
      </label>
      <small className="muted">
        {showPlan && t.plan && <><Link href={`/admin/plans/${t.plan.id}`}>{PLAN_KIND_LABEL[t.plan.kind]}・{t.plan.title}</Link>{t.due_date ? "・" : ""}</>}
        {!showPlan && whoText(t)}
        {!showPlan && teachers && canReassign(t) && !t.done_at && editWho !== t.id && (
          <button type="button" className="adm-link pln-task-who" onClick={() => { setEditWho(t.id); setEditIds(taskAssignees(t)); }}>改負責</button>
        )}
        {t.due_date && `${showPlan ? "" : "・"}${fmtDay(t.due_date)}前`}
        {!t.done_at && t.due_date && t.due_date < today && " ⚠️ 已過期"}
      </small>
      {editWho === t.id && teachers && (
        <span className="pln-task-edit">
          <TeacherPicks teachers={teachers} value={editIds} onChange={setEditIds} label="負責老師" disabled={busy} />
          <button type="button" className="btn btn-sm primary" disabled={busy}
            onClick={() => run(() => setTaskAssignees(t.id, editIds), () => setEditWho(null))}>儲存</button>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setEditWho(null)}>取消</button>
        </span>
      )}
      {!showPlan && (isAdmin || t.created_by === me) && (
        <ConfirmButton label="✕" ariaLabel="刪除待辦" disabled={busy} message="刪除這個待辦？" confirmLabel="刪除" onConfirm={() => run(() => deleteTask(t.id))} />
      )}
    </li>
  );

  return (
    <div className="pln-tasks">
      {open.length === 0 && <p className="muted">{emptyText ?? (showPlan ? "目前沒有指派給你的待辦。" : "沒有未完成的待辦。")}</p>}
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
            onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) { e.preventDefault(); run(() => addTask({ planId, title, assigneeIds: assignees, due, meetingId }), () => { setTitle(""); setDue(""); }); } }} />
          <button type="button" className="btn btn-sm pln-task-assign" aria-expanded={picking} onClick={() => setPicking((v) => !v)}>
            👤 {assignees.length ? namesOf(assignees, teachers) : "未指派"} ▾
          </button>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="期限" />
          <button type="button" className="btn btn-sm" disabled={busy || !title.trim()}
            onClick={() => run(() => addTask({ planId, title, assigneeIds: assignees, due, meetingId }), () => { setTitle(""); setDue(""); })}>＋ 新增</button>
        </div>
      )}
      {planId && teachers && picking && (
        <div className="pln-task-picks">
          <small className="muted">指派給（可複選）：</small>
          <TeacherPicks teachers={teachers} value={assignees} onChange={setAssignees} label="指派給" disabled={busy} />
        </div>
      )}
      {msg && <p className="notice err" role="status">{msg}</p>}
    </div>
  );
}

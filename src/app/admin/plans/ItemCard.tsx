"use client";

import Link from "next/link";
import ConfirmButton from "@/app/admin/ConfirmButton";
import { useState, useTransition } from "react";
import { MAJOR_SHORT } from "@/lib/lessons";
import { SECTIONS, fmtDay, who, type PlanComment, type PlanItem } from "@/lib/plans";
import { deleteItem, saveItem } from "./actions";
import Discussion from "./Discussion";

type T = { id: string; name: string; nickname: string | null };
export type LessonOpt = { id: string; title: string; major: string | null };

// 規劃內容的一項（主修某一堂、走讀／工作坊／故事屋／動滋動一場、營隊某天上午或下午）
// 可修改規劃的人、或這一項的負責老師可以編輯；每一項都可以留言討論
export default function ItemCard({
  planId, section, seq, day, slot, label, item, isNew, canEditPlan, me, isAdmin, lessons, teachers, comments,
}: {
  planId: string;
  section: string;
  seq?: number;
  day?: string;
  slot?: string;
  label?: string;
  item?: PlanItem;
  isNew?: boolean;
  canEditPlan: boolean;
  me: string;
  isAdmin: boolean;
  lessons: LessonOpt[];
  teachers: T[];
  comments: PlanComment[];
}) {
  const sec = SECTIONS[section];
  const blank = { day: day ?? "", title: "", lessonId: "", teacherId: "", notes: "" };
  const fromItem = () => item
    ? { day: item.day ?? day ?? "", title: item.title ?? "", lessonId: item.lesson_id ?? "", teacherId: item.teacher_id ?? "", notes: item.notes ?? "" }
    : blank;
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(fromItem);
  const [talk, setTalk] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const canEdit = canEditPlan || (!!item && item.teacher_id === me);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  const save = () =>
    start(async () => {
      const r = await saveItem({
        planId, id: item?.id, section, seq, day: sec.dated && section !== "camp" ? f.day : day, slot,
        title: f.title, lessonId: f.lessonId, teacherId: f.teacherId, notes: f.notes,
      });
      setMsg(r.ok ? null : r.message);
      if (r.ok) { setEditing(false); if (isNew) setF(blank); }
    });

  const major = sec.major;
  const opts = major ? lessons.filter((l) => l.major === major) : lessons;
  const groups = major ? [[major, opts] as const] : (["lego", "3d", "art"] as const).map((m) => [m, lessons.filter((l) => l.major === m)] as const);

  if (isNew && !editing) {
    return canEditPlan ? (
      <button type="button" className="adm-link pln-add" onClick={() => setEditing(true)}>＋ 新增一場{sec.label}</button>
    ) : null;
  }

  const editor = (
    <div className="pln-item-edit">
      {sec.dated && section !== "camp" && (
        <label>日期<input type="date" value={f.day} onChange={set("day")} /></label>
      )}
      <label>{section.startsWith("major_") ? "這堂的名稱或重點" : section === "camp" ? "活動名稱" : "名稱／場地"}
        <input value={f.title} onChange={set("title")} maxLength={120}
          placeholder={section === "walk" ? "例：科博館恐龍廳" : section.startsWith("major_") ? "例：會動的恐龍尾巴" : "例：聖誕老人的雪橇"} />
      </label>
      <label>教案
        <select value={f.lessonId} onChange={set("lessonId")}>
          <option value="">（還沒選，或不用教案）</option>
          {groups.map(([m, list]) => list.length > 0 && (
            <optgroup key={m} label={MAJOR_SHORT[m] ?? m}>
              {list.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <label>負責老師
        <select value={f.teacherId} onChange={set("teacherId")}>
          <option value="">（未指派）</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.nickname || t.name}</option>)}
        </select>
      </label>
      <label className="wide">{section === "camp" ? "流程與材料" : "備註（流程、材料、注意事項）"}
        <textarea rows={3} value={f.notes} onChange={set("notes")} maxLength={3000}
          placeholder={section === "camp" ? "例：9:30 暖身遊戲 → 10:00 組裝 → 11:30 分享；材料：SPIKE 每 2 人 1 盒、色紙" : ""} />
      </label>
      <div className="adm-btns wide">
        <button type="button" className="btn btn-sm primary" onClick={save} disabled={busy}>{busy ? "儲存中…" : "儲存"}</button>
        <button type="button" className="btn btn-sm" onClick={() => { setEditing(false); setF(fromItem()); setMsg(null); }} disabled={busy}>取消</button>
        {item && canEditPlan && (
          <ConfirmButton label="刪除這一項" disabled={busy} message="確定刪除這一項？底下的留言也會一起刪除。"
            onConfirm={() => start(async () => { const r = await deleteItem(item.id); setMsg(r.ok ? null : r.message); })} />
        )}
      </div>
      {msg && <p className="notice err wide" role="status">{msg}</p>}
    </div>
  );

  const empty = !item || (!item.title && !item.lesson_id && !item.notes && !item.teacher_id);
  return (
    <div className={`pln-item${empty ? " empty" : ""}`}>
      <div className="pln-item-head">
        {label && <span className="pln-item-label">{label}</span>}
        {item?.day && section !== "camp" && <span className="pln-item-label">{fmtDay(item.day)}</span>}
        <div className="pln-item-main">
          {editing ? null : empty ? (
            <span className="muted">{canEdit ? "尚未安排" : "—"}</span>
          ) : (
            <>
              {item?.title && <strong>{item.title}</strong>}
              {item?.lesson && <Link href={`/admin/lessons/${item.lesson.id}`} className="pln-lesson">📚 {item.lesson.title}</Link>}
              {item?.teacher_id && <small className="muted">負責：{who(item.teacher ?? null)}</small>}
              {item?.notes && <p className="pln-notes">{item.notes}</p>}
            </>
          )}
        </div>
        <span className="pln-item-tools lsn-noprint">
          {item && (
            <button type="button" className={`adm-link${comments.length ? " has" : ""}`} onClick={() => setTalk((v) => !v)}>
              💬 {comments.length || "留言"}
            </button>
          )}
          {canEdit && !editing && <button type="button" className="adm-link" onClick={() => { setF(fromItem()); setEditing(true); }}>{empty ? "安排" : "編輯"}</button>}
        </span>
      </div>
      {editing && editor}
      {talk && item && (
        <Discussion planId={planId} itemId={item.id} comments={comments} me={me} isAdmin={isAdmin} canDecide={canEditPlan} compact />
      )}
    </div>
  );
}

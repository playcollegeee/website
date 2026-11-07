"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PLAN_STATUS, type Plan } from "@/lib/plans";
import { deletePlan, setPlanStatus, updatePlan } from "./actions";

type T = { id: string; name: string; nickname: string | null };

// 規劃頁上方：狀態切換、編輯主題與日期、刪除（管理員）
export default function PlanHeader({ plan, canEdit, isAdmin, teachers }: { plan: Plan; canEdit: boolean; isAdmin: boolean; teachers: T[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    title: plan.title, start: plan.start_date ?? "", end: plan.end_date ?? "", summary: plan.summary ?? "", ownerId: plan.owner_id ?? "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <div className="pln-head-tools lsn-noprint">
      <div className="pln-status" role="group" aria-label="狀態">
        {PLAN_STATUS.map((s) => (
          <button key={s.value} type="button" disabled={!canEdit || busy}
            className={`pln-status-btn ${s.value}${plan.status === s.value ? " on" : ""}`}
            onClick={() => start(async () => { const r = await setPlanStatus(plan.id, s.value); setMsg(r.ok ? null : r.message); })}>
            {s.label}
          </button>
        ))}
      </div>
      {canEdit && !editing && <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>編輯主題與日期</button>}
      {isAdmin && (
        <button type="button" className="adm-link danger" disabled={busy}
          onClick={() => {
            if (!confirm(`確定刪除「${plan.title}」？規劃內容、留言、待辦都會一起刪除，無法復原。`)) return;
            start(async () => { const r = await deletePlan(plan.id); if (r.ok) router.push("/admin/plans"); else setMsg(r.message); });
          }}>刪除規劃</button>
      )}
      {editing && (
        <div className="adm-panel pln-info-edit">
          <div className="adm-grid">
            <div className="field adm-wide"><label htmlFor="p-title">主題</label><input id="p-title" value={f.title} onChange={set("title")} maxLength={80} /></div>
            <div className="field"><label htmlFor="p-start">開始日期</label><input id="p-start" type="date" value={f.start} onChange={set("start")} /></div>
            <div className="field"><label htmlFor="p-end">結束日期</label><input id="p-end" type="date" value={f.end} onChange={set("end")} /></div>
            <div className="field"><label htmlFor="p-owner">負責老師</label>
              <select id="p-owner" value={f.ownerId} onChange={set("ownerId")}>
                <option value="">（未指定）</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.nickname || t.name}</option>)}
              </select>
            </div>
            <div className="field adm-wide"><label htmlFor="p-sum">主題說明、目標</label><textarea id="p-sum" rows={3} value={f.summary} onChange={set("summary")} maxLength={3000} /></div>
          </div>
          <div className="adm-btns">
            <button type="button" className="btn btn-sm primary" disabled={busy}
              onClick={() => start(async () => { const r = await updatePlan({ id: plan.id, ...f }); setMsg(r.ok ? null : r.message); if (r.ok) setEditing(false); })}>
              {busy ? "儲存中…" : "儲存"}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setEditing(false)} disabled={busy}>取消</button>
          </div>
        </div>
      )}
      {msg && <p className="notice err" role="status">{msg}</p>}
    </div>
  );
}

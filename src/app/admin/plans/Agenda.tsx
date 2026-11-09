"use client";

import { useState, useTransition } from "react";
import { who, type AgendaItem } from "@/lib/plans";
import ConfirmButton from "@/app/admin/ConfirmButton";
import { addAgenda, deleteAgenda, moveAgenda, updateAgenda } from "./meetingActions";

type T = { id: string; name: string; nickname: string | null };
const blank = { title: "", ownerId: "", minutes: "", notes: "", result: "" };

// 會議議程：議題、負責說明的老師、預計分鐘、會前資料；開完會後 AI 會把每一項的結論填進來（可修改）
export default function Agenda({
  meetingId, items, teachers, me, isAdmin, canManage, showResults,
}: {
  meetingId: string;
  items: AgendaItem[];
  teachers: T[];
  me: string;
  isAdmin: boolean;
  canManage: boolean; // 會議安排人或規劃負責人：可以調整所有議題
  showResults: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null); // 議題 id 或 "new"
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) =>
    start(async () => { const r = await fn(); setMsg(r.ok ? null : r.message); if (r.ok) after?.(); });
  const can = (a: AgendaItem) => isAdmin || canManage || a.created_by === me || a.owner_id === me;
  const total = items.reduce((n, a) => n + (a.minutes ?? 0), 0);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const form = (a?: AgendaItem) => (
    <div className="pln-agenda-form">
      <input value={f.title} onChange={set("title")} maxLength={200} placeholder="議題，例：這一季主題三選一" aria-label="議題" autoFocus />
      <select value={f.ownerId} onChange={set("ownerId")} aria-label="負責說明">
        <option value="">（負責說明的老師）</option>
        {teachers.map((t) => <option key={t.id} value={t.id}>{t.nickname || t.name}</option>)}
      </select>
      <input type="number" min={1} max={240} value={f.minutes} onChange={set("minutes")} placeholder="分鐘" aria-label="預計分鐘" />
      <textarea rows={2} value={f.notes} onChange={set("notes")} maxLength={2000} className="wide" aria-label="會前資料"
        placeholder="會前資料、要先看的連結、要決定的事（選填）" />
      {a && showResults && (
        <textarea rows={2} value={f.result} onChange={set("result")} maxLength={2000} className="wide" aria-label="結論" placeholder="結論" />
      )}
      <div className="adm-btns wide">
        <button type="button" className="btn btn-sm primary" disabled={busy || !f.title.trim()}
          onClick={() => run(
            () => (a ? updateAgenda({ id: a.id, ...f, ...(showResults ? {} : { result: undefined }) }) : addAgenda({ meetingId, ...f })),
            () => { setEditing(null); setF(blank); },
          )}>
          {a ? "儲存" : "加入議程"}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => { setEditing(null); setF(blank); }}>取消</button>
      </div>
    </div>
  );

  return (
    <div className="pln-agenda">
      <h4>📋 議程 <small>{items.length} 項{total ? `・預計 ${total} 分鐘` : ""}</small></h4>
      {items.length === 0 && editing !== "new" && <p className="muted">還沒有議題，大家可以先把想討論的事加進來。</p>}
      <ol>
        {items.map((a, i) => (
          <li key={a.id}>
            {editing === a.id ? form(a) : (
              <>
                <div className="pln-agenda-row">
                  <strong>{a.title}</strong>
                  <small className="muted">{a.owner_id ? `　${who(a.owner ?? null)}` : ""}{a.minutes ? `・${a.minutes} 分` : ""}</small>
                  {can(a) && (
                    <span className="pln-agenda-tools">
                      <button type="button" className="adm-link" disabled={busy || i === 0} onClick={() => run(() => moveAgenda(a.id, -1))} aria-label="往上">↑</button>
                      <button type="button" className="adm-link" disabled={busy || i === items.length - 1} onClick={() => run(() => moveAgenda(a.id, 1))} aria-label="往下">↓</button>
                      <button type="button" className="adm-link" onClick={() => { setEditing(a.id); setF({ title: a.title, ownerId: a.owner_id ?? "", minutes: a.minutes ? String(a.minutes) : "", notes: a.notes ?? "", result: a.result ?? "" }); }}>編輯</button>
                      <ConfirmButton label="刪除" disabled={busy} message="刪除這個議題？" confirmLabel="刪除" onConfirm={() => run(() => deleteAgenda(a.id))} />
                    </span>
                  )}
                </div>
                {a.notes && <p className="pln-notes">{a.notes}</p>}
                {showResults && (
                  <p className={`pln-agenda-result${a.result ? "" : " none"}`}>➜ {a.result || "（還沒有結論）"}</p>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
      {editing === "new" ? form() : (
        <button type="button" className="adm-link" onClick={() => { setEditing("new"); setF(blank); }}>＋ 加一個議題</button>
      )}
      {msg && <p className="notice err" role="status">{msg}</p>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMeeting } from "../../plans/meetingActions";

// 會議室標題：名稱（自動帶入「第 X 次會議」）與日期可以修改
export default function MeetingTitle({ id, title, heldOn, canEdit }: { id: string; title: string; heldOn: string | null; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(title);
  const [d, setD] = useState(heldOn ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!editing) {
    return (
      <h1 className="room-title">
        🧩 {title}
        {canEdit && <button type="button" className="adm-link" onClick={() => setEditing(true)}>修改名稱、日期</button>}
      </h1>
    );
  }
  return (
    <div className="room-title-edit">
      <input value={t} maxLength={80} onChange={(e) => setT(e.target.value)} aria-label="會議名稱" autoFocus />
      <input type="date" value={d} onChange={(e) => setD(e.target.value)} aria-label="開會日期" />
      <button type="button" className="btn btn-sm primary" disabled={pending || !t.trim()}
        onClick={() => start(async () => {
          const r = await updateMeeting({ id, title: t, heldOn: d });
          setMsg(r.ok ? null : r.message);
          if (r.ok) { setEditing(false); router.refresh(); }
        })}>{pending ? "儲存中…" : "儲存"}</button>
      <button type="button" className="btn btn-sm" onClick={() => { setEditing(false); setT(title); setD(heldOn ?? ""); }}>取消</button>
      {msg && <p className="notice err">{msg}</p>}
    </div>
  );
}

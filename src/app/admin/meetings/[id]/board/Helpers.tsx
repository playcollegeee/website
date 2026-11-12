"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setHelpers } from "./actions";

type T = { id: string; name: string; nickname: string | null };

// 小幫手老師：和會議建立者一樣，可以改、刪白板上任何便利貼與分區框
export default function Helpers({
  meetingId, teachers, helperIds, creatorId, canSet, mod,
}: {
  meetingId: string; teachers: T[]; helperIds: string[]; creatorId: string | null; canSet: boolean; mod: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(helperIds);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const name = (id: string | null) => {
    const t = teachers.find((x) => x.id === id);
    return t ? t.nickname || t.name : "（已離職）";
  };

  return (
    <div className="bd-helpers">
      <span>
        <strong>主持：</strong>{creatorId ? name(creatorId) : "—"}
        <strong>　👥 小幫手：</strong>{helperIds.length ? helperIds.map(name).join("、") : "（還沒設定）"}
        {mod && <small className="muted">　你可以整理整塊白板</small>}
      </span>
      {canSet && !open && <button type="button" className="adm-link" onClick={() => setOpen(true)}>設定小幫手</button>}
      {open && (
        <div className="bd-helpers-pick">
          <p className="hint">小幫手老師可以修改、刪除白板上所有人的便利貼與分區框。</p>
          <div className="bd-helpers-list">
            {teachers.filter((t) => t.id !== creatorId).map((t) => (
              <label key={t.id} className="adm-check">
                <input type="checkbox" checked={picked.includes(t.id)}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, t.id] : p.filter((x) => x !== t.id)))} />
                {t.nickname || t.name}
              </label>
            ))}
          </div>
          <div className="adm-btns">
            <button type="button" className="btn btn-sm primary" disabled={pending}
              onClick={() => start(async () => {
                const r = await setHelpers(meetingId, picked);
                setMsg({ ok: r.ok, text: r.message });
                if (r.ok) { setOpen(false); router.refresh(); }
              })}>
              {pending ? "儲存中…" : "儲存"}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => { setOpen(false); setPicked(helperIds); }}>取消</button>
          </div>
        </div>
      )}
      {msg && <p className={`notice ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</p>}
    </div>
  );
}

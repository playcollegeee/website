"use client";

import { useState, useTransition } from "react";
import type { EvResult } from "./actions";

// 後台小按鈕：按下呼叫 server action，顯示結果；ask 有值時先在頁面上確認（不用瀏覽器 confirm）
export default function ActBtn({
  run,
  label,
  ask,
  className = "btn btn-sm",
  confirmLabel = "確定",
}: {
  run: () => Promise<EvResult>;
  label: React.ReactNode;
  ask?: string;
  className?: string;
  confirmLabel?: string;
}) {
  const [busy, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState<EvResult | null>(null);
  const go = () =>
    start(async () => {
      setAsking(false);
      const r = await run();
      setMsg(r.message ? r : null);
    });
  return (
    <span className="ev-act">
      {asking ? (
        <span className="adm-confirm" role="alertdialog" aria-label={ask}>
          <span>{ask}</span>
          <button type="button" className="btn btn-sm danger" onClick={go} disabled={busy} autoFocus>{confirmLabel}</button>
          <button type="button" className="btn btn-sm" onClick={() => setAsking(false)}>取消</button>
        </span>
      ) : (
        <button type="button" className={className} disabled={busy} onClick={() => (ask ? setAsking(true) : go())}>
          {busy ? "處理中…" : label}
        </button>
      )}
      {msg && <span className={`ph-msg ${msg.ok ? "ok" : "err"}`} role="status">{msg.message}</span>}
    </span>
  );
}

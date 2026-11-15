"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { importPlans } from "../actions";

// 從課程規劃一鍵帶入營隊（同年、同類、還沒帶入過的營隊規劃）
export default function PlanImport({ seasonId, plans }: { seasonId: string; plans: { id: string; label: string; sub: string }[] }) {
  const [picked, setPicked] = useState<string[]>(plans.map((p) => p.id));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  if (plans.length === 0) {
    return (
      <p className="hint">
        {msg && <span className={`ph-msg ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}。</span>}
        課程規劃裡沒有還沒帶入的同季營隊。要新的一梯，先到 <Link href="/admin/plans">課程規劃</Link> 新增「冬夏令營」並排好日期。
      </p>
    );
  }
  return (
    <div className="adm-panel cmp-import">
      <strong>📥 從課程規劃帶入</strong>
      <p className="hint">每一份營隊規劃會變成一個營隊，並自動建好報名草稿（日期每天 9:30–16:00、沿用上一個營隊的地點與題目）。</p>
      <ul className="cmp-checks">
        {plans.map((p) => (
          <li key={p.id}>
            <label>
              <input
                type="checkbox"
                checked={picked.includes(p.id)}
                onChange={(e) => setPicked((l) => (e.target.checked ? [...l, p.id] : l.filter((x) => x !== p.id)))}
              />
              <strong>{p.label}</strong> <span className="hint">{p.sub}</span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-sm primary"
        disabled={busy || picked.length === 0}
        onClick={() =>
          start(async () => {
            const r = await importPlans(seasonId, picked);
            setMsg({ ok: r.ok, text: r.message });
          })
        }
      >
        {busy ? "帶入中…" : `帶入 ${picked.length} 個營隊`}
      </button>
      {msg && <span className={`ph-msg ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</span>}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { autoTitle, campType, type PlanKind } from "@/lib/plans";
import { createPlan } from "./actions";

// 新增規劃：只選時間，名稱自動帶入（季主題：2027 第1季；月份主題：2027 3月份主題；營隊：2027冬令營第1梯）
// 主題等老師討論完，再到規劃頁「編輯」填寫
export default function PlanCreate({ kind, campTitles }: { kind: PlanKind; campTitles: string[] }) {
  const router = useRouter();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [month, setMonth] = useState("");
  const [summary, setSummary] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, go] = useTransition();

  const from = kind === "month" ? (month ? `${month}-01` : "") : start;
  const campCount = kind === "camp" && start ? campTitles.filter((t) => t.startsWith(`${start.slice(0, 4)}${campType(start)}`)).length : 0;
  const preview = from ? autoTitle(kind, from, campCount) : "";
  const ready = kind === "month" ? !!month : kind === "camp" ? !!start && !!end : !!start;

  return (
    <div className="adm-form">
      <div className="adm-grid">
        {kind === "month" ? (
          <div className="field">
            <label htmlFor="n-month">月份 *</label>
            <input id="n-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="n-start">{kind === "camp" ? "營隊第一天 *" : "開始日期 *"}</label>
              <input id="n-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="n-end">{kind === "camp" ? "營隊最後一天 *" : "結束日期"}</label>
              <input id="n-end" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </>
        )}
        <div className="field adm-wide">
          <label htmlFor="n-sum">說明（選填）</label>
          <textarea id="n-sum" rows={2} maxLength={3000} value={summary} onChange={(e) => setSummary(e.target.value)}
            placeholder="例：這一季想往「動物」方向發想，配合春天的走讀" />
        </div>
      </div>
      <p className="pln-preview">
        名稱會自動帶入：<strong>{preview || "（選好時間後顯示）"}</strong>
        <small className="muted">　主題等大家討論完，再到規劃頁按「編輯」填寫。</small>
      </p>
      <button type="button" className="btn primary" disabled={!ready || busy}
        onClick={() => go(async () => {
          const r = await createPlan({ kind, start, end, month, summary });
          if (r.ok && r.id) router.push(`/admin/plans/${r.id}`);
          else setMsg(r.message);
        })}>
        {busy ? "建立中…" : "建立"}
      </button>
      {msg && <p className="notice err" role="status">{msg}</p>}
    </div>
  );
}

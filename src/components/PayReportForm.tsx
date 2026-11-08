"use client";

import { useState } from "react";

// 家長回填匯款帳號末五碼
export default function PayReportForm({ code, token, current }: { code: string; token: string; current: string | null }) {
  const [value, setValue] = useState(current ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(current ? { ok: true, text: `已回填末五碼 ${current}，我們對帳後會通知您。` } : null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/signup/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, token, last5: value }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "送出失敗");
      setMsg({ ok: true, text: `已回填末五碼 ${value}，我們對帳後會通知您。` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "送出失敗" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="su-pay" onSubmit={submit}>
      <div className="field">
        <label htmlFor="last5">匯款帳號末五碼</label>
        <input id="last5" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" pattern="\d{5}" required placeholder="12345" />
      </div>
      <button type="submit" className="btn primary" disabled={busy}>{busy ? "送出中…" : current ? "更新" : "送出"}</button>
      {msg && <p className={`notice ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</p>}
    </form>
  );
}

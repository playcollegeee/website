"use client";

import { useState } from "react";

// 「我想上這堂」：留下聯絡方式，同一主題湊到 3 人以上就開課
export default function InterestForm({ themeId, themeTitle }: { themeId: string; themeTitle: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok">("idle");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "");
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themeId,
          contactName: s("contactName"),
          phone: s("phone"),
          email: s("email"),
          socialName: s("socialName"),
          headcount: s("headcount"),
          whoText: s("whoText"),
          preferText: s("preferText"),
          consent: f.get("consent") === "on",
          website: s("website"),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "送出失敗");
      setStatus("ok");
    } catch (err) {
      setError(err instanceof Error ? err.message : "送出失敗");
      setStatus("idle");
    }
  }
  if (status === "ok")
    return (
      <div className="notice ok pop-in">
        <p style={{ margin: 0 }}>收到了，謝謝！</p>
        <p style={{ margin: "6px 0 0", fontWeight: 400 }}>「{themeTitle}」湊到 3 人以上我們就會開課，到時候會私訊或打電話通知您。</p>
      </div>
    );
  return (
    <form className="form" onSubmit={submit}>
      <div className="grid cols-2">
        <div className="field">
          <label htmlFor="i-name">聯絡人姓名 *</label>
          <input id="i-name" name="contactName" required maxLength={40} />
        </div>
        <div className="field">
          <label htmlFor="i-phone">手機 *</label>
          <input id="i-phone" name="phone" required maxLength={20} inputMode="tel" />
        </div>
        <div className="field">
          <label htmlFor="i-email">Email（選填）</label>
          <input id="i-email" name="email" type="email" maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="i-social">私訊粉專／IG 用的名字（選填）</label>
          <input id="i-social" name="socialName" maxLength={60} />
        </div>
        <div className="field">
          <label htmlFor="i-count">人數</label>
          <select id="i-count" name="headcount" defaultValue="1">
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="i-who">參加者（選填）</label>
          <input id="i-who" name="whoText" maxLength={120} placeholder="例：小四、小二兄妹" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="i-prefer">方便的時間或地區（選填）</label>
        <input id="i-prefer" name="preferText" maxLength={200} placeholder="例：寒假平日上午、台中北屯" />
      </div>
      <label className="check">
        <input type="checkbox" name="consent" required />
        <span>同意玩學院用以上資料通知我開課消息 *</span>
      </label>
      <input className="honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {error && <p className="notice err" role="alert">{error}</p>}
      <div><button type="submit" className="btn primary" disabled={status === "sending"}>{status === "sending" ? "送出中…" : "我想上這堂"}</button></div>
    </form>
  );
}

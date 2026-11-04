"use client";

import Link from "next/link";
import { useState } from "react";
import { burstConfetti } from "@/lib/confetti";
import { levels, majors, site } from "@/lib/content";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "ok" } | { kind: "err"; message: string };

export default function TrialForm({
  defaultType = "trial",
  defaultLevel = "",
  defaultMajors = [],
}: {
  defaultType?: string;
  defaultLevel?: string;
  defaultMajors?: string[];
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const payload = {
      type: String(form.get("type") ?? "trial"),
      guardianName: String(form.get("guardianName") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      childLevel: String(form.get("childLevel") ?? ""),
      interests: form.getAll("interests").map(String),
      message: String(form.get("message") ?? ""),
      consent: form.get("consent") === "on",
      website: String(form.get("website") ?? ""), // 防機器人欄位，正常人看不到
    };
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "送出失敗");
      const r = formEl.getBoundingClientRect();
      formEl.reset();
      setStatus({ kind: "ok" });
      burstConfetti(r.left + r.width / 2, Math.min(window.innerHeight * 0.7, r.top + 120), 120);
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "送出失敗" });
    }
  }

  if (status.kind === "ok") {
    return <div className="notice ok pop-in">收到了，謝謝！我們會在 1–2 個工作天內與你聯絡。</div>;
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="type">想詢問的是</label>
        <select id="type" name="type" defaultValue={defaultType}>
          <option value="trial">預約試聽</option>
          <option value="workshop">活動與工作坊通知</option>
          <option value="school">學校／機構合作</option>
          <option value="other">其他問題</option>
        </select>
      </div>
      <div className="grid cols-2">
        <div className="field">
          <label htmlFor="guardianName">家長姓名（或聯絡人）*</label>
          <input id="guardianName" name="guardianName" required maxLength={40} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="phone">聯絡電話 *</label>
          <input id="phone" name="phone" required maxLength={20} inputMode="tel" autoComplete="tel" />
        </div>
      </div>
      <div className="grid cols-2">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" maxLength={120} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="childLevel">孩子目前的年級</label>
          <select id="childLevel" name="childLevel" defaultValue={defaultLevel}>
            <option value="">請選擇</option>
            {levels.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.grades}（{l.name}）
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 700, marginBottom: 6 }}>有興趣的主修（可複選）</legend>
        {majors.map((m) => (
          <label key={m.slug} style={{ fontWeight: 400, display: "inline-flex", gap: 6, marginRight: 16 }}>
            <input type="checkbox" name="interests" value={m.slug} defaultChecked={defaultMajors.includes(m.slug)} style={{ width: "auto" }} />
            {m.short}
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="message">想跟我們說的話</label>
        <textarea id="message" name="message" rows={4} maxLength={1000} placeholder="例如：孩子喜歡什麼、方便的上課時段、學校合作需求…" />
      </div>
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website">請勿填寫</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input type="checkbox" name="consent" required style={{ width: "auto", marginTop: 6 }} />
        <span className="hint">
          我同意{site.name}使用以上資料聯絡我、安排試聽與提供課程資訊；資料不會提供給第三方。詳見
          <Link href="/privacy" target="_blank">隱私權政策</Link>。
        </span>
      </label>
      {status.kind === "err" && (
        <div className="notice err">
          {status.message}。也可以直接寫信到 <a href={`mailto:${site.email}`}>{site.email}</a>。
        </div>
      )}
      <div>
        <button className="btn primary" type="submit" disabled={status.kind === "sending"}>
          {status.kind === "sending" ? "送出中…" : "送出"}
        </button>
      </div>
    </form>
  );
}

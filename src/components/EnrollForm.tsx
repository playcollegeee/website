"use client";

import { useState } from "react";
import { burstConfetti } from "@/lib/confetti";
import { levels, majors } from "@/lib/content";
import { CONSENT_NOTICE, DEFAULT_PHOTO_SCOPE, PHOTO_SCOPES } from "@/lib/consent";

// 線上新生報名表：送出後存成「待審核」，老師確認後才建立學生資料。
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "ok" } | { kind: "err"; message: string };

const RELATIONS = ["媽媽", "爸爸", "阿嬤", "阿公", "外婆", "外公", "其他"];

export default function EnrollForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [care, setCare] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    const f = new FormData(el);
    const s = (k: string) => String(f.get(k) ?? "");
    const payload = {
      childName: s("childName"),
      nickname: s("nickname"),
      level: s("level"),
      birthYear: s("birthYear"),
      gender: s("gender"),
      school: s("school"),
      interests: f.getAll("interests").map(String),
      guardianName: s("guardianName"),
      relation: s("relation"),
      phone: s("phone"),
      email: s("email"),
      pickupName: s("pickupName"),
      pickupRelation: s("pickupRelation"),
      pickupPhone: s("pickupPhone"),
      photoScope: s("photoScope"),
      careNotes: s("careNotes"),
      careConsent: f.get("careConsent") === "on",
      marketing: f.get("marketing") === "on",
      message: s("message"),
      consent: f.get("consent") === "on",
      website: s("website"),
    };
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "送出失敗");
      const r = el.getBoundingClientRect();
      setStatus({ kind: "ok" });
      window.scrollTo({ top: Math.max(0, window.scrollY + r.top - 120), behavior: "smooth" });
      burstConfetti(window.innerWidth / 2, window.innerHeight * 0.4, 140);
    } catch (err) {
      setStatus({ kind: "err", message: err instanceof Error ? err.message : "送出失敗" });
    }
  }

  if (status.kind === "ok") {
    return (
      <div className="notice ok pop-in">
        <p style={{ margin: 0 }}>報名資料收到了，謝謝！</p>
        <p style={{ margin: "6px 0 0", fontWeight: 400 }}>
          老師會在 1–2 個工作天內與您確認班級與時段。第一次到教室時，請簽一份紙本個資同意書。
        </p>
      </div>
    );
  }

  return (
    <form className="form enroll-form" onSubmit={onSubmit}>
      <fieldset>
        <legend>孩子</legend>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="childName">孩子姓名 *</label>
            <input id="childName" name="childName" required maxLength={40} />
          </div>
          <div className="field">
            <label htmlFor="nickname">角色暱稱 *</label>
            <input id="nickname" name="nickname" required maxLength={20} placeholder="例：閃電小明" />
            <small>和孩子一起取一個！會出現在教室讀卡站與角色卡上，請不要用本名。</small>
          </div>
          <div className="field">
            <label htmlFor="level">階段 *</label>
            <select id="level" name="level" required defaultValue="">
              <option value="" disabled>請選擇</option>
              {levels.map((l) => (
                <option key={l.slug} value={l.slug}>{l.name}（{l.grades}）</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="birthYear">出生年（西元，選填）</label>
            <input id="birthYear" name="birthYear" inputMode="numeric" pattern="(19|20)\d{2}" maxLength={4} placeholder="2017" />
          </div>
          <div className="field">
            <label htmlFor="gender">性別（選填）</label>
            <select id="gender" name="gender" defaultValue="">
              <option value="">不填</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="school">就讀學校（選填）</label>
            <input id="school" name="school" maxLength={60} />
          </div>
        </div>
        <div className="field">
          <span className="label">有興趣的主修（可複選）</span>
          <div className="enroll-majors">
            {majors.map((m) => (
              <label key={m.slug}>
                <input type="checkbox" name="interests" value={m.slug} /> {m.name}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>家長（主要聯絡人）</legend>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="guardianName">姓名 *</label>
            <input id="guardianName" name="guardianName" required maxLength={40} autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="relation">和孩子的關係</label>
            <select id="relation" name="relation" defaultValue="媽媽">
              {RELATIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="phone">手機 *</label>
            <input id="phone" name="phone" required maxLength={20} inputMode="tel" autoComplete="tel" />
          </div>
          <div className="field">
            <label htmlFor="email">Email（選填）</label>
            <input id="email" name="email" type="email" maxLength={120} autoComplete="email" />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>其他可接送的人（選填）</legend>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="pickupName">姓名</label>
            <input id="pickupName" name="pickupName" maxLength={40} />
          </div>
          <div className="field">
            <label htmlFor="pickupRelation">關係</label>
            <select id="pickupRelation" name="pickupRelation" defaultValue="">
              <option value="">請選擇</option>
              {RELATIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pickupPhone">手機</label>
            <input id="pickupPhone" name="pickupPhone" maxLength={20} inputMode="tel" />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>照片與作品</legend>
        <div className="radios">
          {PHOTO_SCOPES.map((p) => (
            <label key={p.value}>
              <input type="radio" name="photoScope" value={p.value} defaultChecked={p.value === DEFAULT_PHOTO_SCOPE} />
              <span><strong>{p.label}</strong><small>{p.hint}</small></span>
            </label>
          ))}
        </div>
        <small className="hint">我們會在官網與社群分享孩子的學習成果。不同意請在上面改選，之後也可以隨時用 LINE 或 Email 告訴我們。</small>
      </fieldset>

      <fieldset>
        <legend>照護注意事項（選填）</legend>
        <div className="field">
          <label htmlFor="careNotes">過敏、身體狀況或需要老師特別留意的地方</label>
          <textarea id="careNotes" name="careNotes" rows={2} maxLength={500} value={care} onChange={(e) => setCare(e.target.value)} />
        </div>
        {care.trim() && (
          <label className="check">
            <input type="checkbox" name="careConsent" required />
            <span>同意玩學院記錄上述照護注意事項，只提供給授課老師照顧孩子使用。*</span>
          </label>
        )}
      </fieldset>

      <div className="field">
        <label htmlFor="message">想告訴老師的話（選填）</label>
        <textarea id="message" name="message" rows={3} maxLength={1000} placeholder="想上的時段、孩子的個性或興趣…" />
      </div>

      <details className="notice-box">
        <summary>個人資料蒐集告知事項（請展開閱讀）</summary>
        <dl>
          {CONSENT_NOTICE.map((n) => (
            <div key={n.title}>
              <dt>{n.title}</dt>
              <dd>{n.body}</dd>
            </div>
          ))}
        </dl>
        <p>完整內容請見 <a href="/privacy" target="_blank">隱私權政策</a>。</p>
      </details>

      <label className="check">
        <input type="checkbox" name="marketing" />
        <span>我願意收到玩學院的課程與活動訊息（選填）</span>
      </label>
      <label className="check">
        <input type="checkbox" name="consent" required />
        <span>我是孩子的法定代理人，已閱讀並同意上述個人資料蒐集告知事項。*</span>
      </label>

      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website">請勿填寫</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {status.kind === "err" && <p className="notice err" role="alert">{status.message}</p>}
      <button type="submit" className="btn primary" disabled={status.kind === "sending"}>
        {status.kind === "sending" ? "送出中…" : "送出報名"}
      </button>
    </form>
  );
}

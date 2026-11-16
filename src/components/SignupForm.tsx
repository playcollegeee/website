"use client";

import { useMemo, useState } from "react";
import { burstConfetti } from "@/lib/confetti";
import { ACTIVITY_CONSENT_NOTICE } from "@/lib/consent";
import { gradesInRange, money, type Price, type Question, type Unit, type Who } from "@/lib/eventTypes";

// 官網活動報名表：選場次 → 選方案 → 填參加者 → 聯絡方式 → 須知與同意
export type SignupSlot = {
  id: string;
  label: string;
  timesText: string;
  place: string;
  left: number;
  capacity: number;
  waitlist: boolean;
  confirmed: boolean;
};
// grade：年級數字的字串；大人小孩都可以的活動多一個 "adult"（成人）
type PersonRow = { name: string; grade: string; care: string; careConsent: boolean; showCare: boolean };

const emptyPerson = (): PersonRow => ({ name: "", grade: "", care: "", careConsent: false, showCare: false });
const MAX_SEATS = 12;

export default function SignupForm({
  runId,
  who,
  unit,
  payMode,
  prices,
  questions,
  slots,
  refundText,
  gradeMin,
  gradeMax,
}: {
  runId: string;
  who: Who;
  unit: Unit;
  payMode: "now" | "after_confirm";
  prices: Price[];
  questions: Question[];
  slots: SignupSlot[];
  refundText: string;
  gradeMin?: number | null;
  gradeMax?: number | null;
}) {
  const unitLabel = unit === "group" ? "組" : "位";
  const [slotId, setSlotId] = useState(slots.length === 1 ? slots[0].id : "");
  // 每個方案各選幾份（可以混搭，例如兩人同行 1 份＋單人 1 份）；只有一個方案時預設 1 份
  const [qtys, setQtys] = useState<Record<string, number>>(() => (prices.length === 1 ? { [prices[0].key]: 1 } : {}));
  const seats = prices.reduce((n, p) => n + (qtys[p.key] ?? 0) * Math.max(p.seats, 1), 0);
  const total = prices.reduce((n, p) => n + (qtys[p.key] ?? 0) * p.amount, 0);
  const picked = prices.filter((p) => (qtys[p.key] ?? 0) > 0);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const grades = gradesInRange(gradeMin, gradeMax);
  function bump(key: string, d: number) {
    const p = prices.find((x) => x.key === key);
    const next = Math.max(0, Math.min(10, (qtys[key] ?? 0) + d));
    if (d > 0 && p && seats + Math.max(p.seats, 1) > MAX_SEATS) return;
    setQtys({ ...qtys, [key]: next });
  }
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const slot = slots.find((s) => s.id === slotId);
  const willWait = !!slot && slot.left < seats;

  // 參加者欄位數跟著方案與份數變
  const rows = useMemo(() => {
    if (people.length === seats) return people;
    return Array.from({ length: seats }, (_, i) => people[i] ?? emptyPerson());
  }, [people, seats]);

  function setRow(i: number, patch: Partial<PersonRow>) {
    setPeople(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!slotId) return setError("請選擇場次");
    if (seats === 0) return setError("請選擇報名方案與份數");
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "");
    const answers: Record<string, string> = {};
    for (const q of questions) answers[q.key] = s(`q_${q.key}`);
    const payload = {
      runId,
      slotId,
      items: picked.map((p) => ({ key: p.key, qty: qtys[p.key] })),
      people: rows.map((r) => {
        const adult = who === "adult" || r.grade === "adult";
        return { kind: adult ? "adult" : "child", name: r.name, grade: adult ? "" : r.grade, careNotes: r.care, careConsent: r.careConsent };
      }),
      phone: s("phone"),
      email: s("email"),
      socialName: s("socialName"),
      answers,
      message: s("message"),
      refundAck: f.get("refundAck") === "on",
      consent: f.get("consent") === "on",
      photoOk: f.get("photoOk") === "on",
      marketing: f.get("marketing") === "on",
      website: s("website"),
    };
    setSending(true);
    try {
      const res = await fetch("/api/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; link?: string };
      if (!res.ok || !data.link) throw new Error(data.error ?? "送出失敗");
      burstConfetti(window.innerWidth / 2, window.innerHeight * 0.4, 140);
      window.location.href = data.link;
    } catch (err) {
      setError(err instanceof Error ? err.message : "送出失敗");
      setSending(false);
    }
  }

  return (
    <form className="form su-form" onSubmit={onSubmit}>
      <fieldset>
        <legend>1　選場次</legend>
        <div className="su-options">
          {slots.map((sl) => {
            const full = sl.left <= 0;
            const disabled = full && !sl.waitlist;
            return (
              <label key={sl.id} className={`su-option ${slotId === sl.id ? "on" : ""} ${disabled ? "off" : ""}`}>
                <input type="radio" name="slot" value={sl.id} checked={slotId === sl.id} disabled={disabled} onChange={() => setSlotId(sl.id)} />
                <span className="su-option-main">
                  <strong>{sl.label}</strong>
                  <small>{sl.timesText}</small>
                  {sl.place && <small>{sl.place}</small>}
                </span>
                <span className={`su-left ${full ? "full" : ""}`}>
                  {full ? (sl.waitlist ? "額滿・可候補" : "額滿") : sl.left <= 3 ? `剩 ${sl.left} ${unitLabel}` : "名額充足"}
                  {sl.confirmed && <em>確定開課</em>}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend>2　選方案與份數</legend>
        <div className="su-options">
          {prices.map((p) => {
            const n = qtys[p.key] ?? 0;
            return (
              <div key={p.key} className={`su-option su-plan ${n > 0 ? "on" : ""}`}>
                <span className="su-option-main">
                  <strong>{p.label}</strong>
                  <small>
                    {p.seats > 1 ? `一份含 ${p.seats} ${unitLabel}` : `每${unitLabel === "組" ? "組" : "人"}`}
                    {p.returning_only ? "・參加過玩學院活動的舊生" : ""}
                  </small>
                </span>
                <span className="su-price">${money(p.amount)}</span>
                <span className="su-step">
                  <button type="button" onClick={() => bump(p.key, -1)} disabled={n === 0} aria-label={`${p.label} 減少一份`}>−</button>
                  <output aria-label={`${p.label} 份數`}>{n}</output>
                  <button type="button" onClick={() => bump(p.key, 1)} disabled={seats + Math.max(p.seats, 1) > MAX_SEATS} aria-label={`${p.label} 增加一份`}>＋</button>
                </span>
              </div>
            );
          })}
        </div>
        <p className="hint su-plan-sum" role="status">
          {seats === 0
            ? "按 ＋ 選擇份數，不同方案可以一起選。例如 3 人參加：兩人同行 1 份＋單人 1 份。"
            : `已選 ${picked.map((p) => `${p.label} × ${qtys[p.key]}`).join("＋")}，共 ${seats} ${unitLabel}，$${money(total)}`}
        </p>
      </fieldset>

      <fieldset>
        <legend>3　參加者{unit === "group" ? "（每組記錄孩子）" : ""}</legend>
        {seats === 0 && <p className="hint">先在上面選方案與份數，這裡會出現對應人數的欄位。</p>}
        {rows.map((r, i) => (
          <div key={i} className="su-person">
            <p className="su-person-no">第 {i + 1} {unitLabel}</p>
            <div className="grid cols-2">
              <div className="field">
                <label htmlFor={`pname-${i}`}>{who === "kids" || who === "family" ? "孩子姓名 *" : "姓名 *"}</label>
                <input id={`pname-${i}`} value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} required maxLength={40} />
                <small className="hint">會用來做桌牌，公開照片時不寫全名。</small>
              </div>
              {who !== "adult" && (
                <div className="field">
                  <label htmlFor={`pgrade-${i}`}>{who === "any" ? "成人／孩子年級 *" : "年級 *"}</label>
                  <select id={`pgrade-${i}`} value={r.grade} onChange={(e) => setRow(i, { grade: e.target.value })} required>
                    <option value="" disabled>請選擇</option>
                    {who === "any" && <option value="adult">成人</option>}
                    {grades.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {!r.showCare ? (
              <button type="button" className="su-link" onClick={() => setRow(i, { showCare: true })}>＋ 需要老師留意的地方</button>
            ) : (
              <div className="field">
                <label htmlFor={`pcare-${i}`}>需要老師留意的地方</label>
                <input id={`pcare-${i}`} value={r.care} onChange={(e) => setRow(i, { care: e.target.value })} maxLength={300} placeholder="例：花生過敏、容易緊張" />
                {r.care.trim() && (
                  <label className="check">
                    <input type="checkbox" checked={r.careConsent} onChange={(e) => setRow(i, { careConsent: e.target.checked })} required />
                    <span>同意玩學院記錄上述注意事項，只提供給授課老師照顧參加者使用。*</span>
                  </label>
                )}
              </div>
            )}
          </div>
        ))}
      </fieldset>

      <fieldset>
        <legend>4　聯絡方式</legend>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="phone">手機 *</label>
            <input id="phone" name="phone" required maxLength={20} inputMode="tel" autoComplete="tel" />
          </div>
          <div className="field">
            <label htmlFor="email">Email *</label>
            <input id="email" name="email" type="email" required maxLength={120} autoComplete="email" />
            <small className="hint">報名確認與上課提醒會寄到這裡。</small>
          </div>
          <div className="field">
            <label htmlFor="socialName">私訊粉專／IG 用的名字 *</label>
            <input id="socialName" name="socialName" required maxLength={60} />
            <small className="hint">我們會用私訊和您確認匯款、傳上課提醒。</small>
          </div>
        </div>
        {questions.map((q) => (
          <div className="field" key={q.key}>
            <label htmlFor={`q_${q.key}`}>{q.label}{q.required ? " *" : ""}</label>
            {q.type === "choice" ? (
              <select id={`q_${q.key}`} name={`q_${q.key}`} required={q.required} defaultValue="">
                <option value="">請選擇</option>
                {(q.options ?? []).map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input id={`q_${q.key}`} name={`q_${q.key}`} required={q.required} maxLength={300} />
            )}
          </div>
        ))}
        <div className="field">
          <label htmlFor="message">想告訴老師的話（選填）</label>
          <textarea id="message" name="message" rows={2} maxLength={1000} />
        </div>
      </fieldset>

      <fieldset>
        <legend>5　須知與同意</legend>
        <details className="notice-box su-refund" open>
          <summary>取消與更改辦法（重要須知）</summary>
          <p className="su-pre">{refundText}</p>
        </details>
        <label className="check">
          <input type="checkbox" name="refundAck" required />
          <span>我已閱讀並同意取消與更改辦法 *</span>
        </label>
        <details className="notice-box">
          <summary>個人資料蒐集告知事項（請展開閱讀）</summary>
          <dl>
            {ACTIVITY_CONSENT_NOTICE.map((n) => (
              <div key={n.title}>
                <dt>{n.title}</dt>
                <dd>{n.body}</dd>
              </div>
            ))}
          </dl>
          <p>完整內容請見 <a href="/privacy" target="_blank">隱私權政策</a>。</p>
        </details>
        <label className="check">
          <input type="checkbox" name="consent" required />
          <span>我已閱讀並同意個資告知事項 *</span>
        </label>
        <label className="check">
          <input type="checkbox" name="photoOk" defaultChecked />
          <span>活動照片可以分享在玩學院官網與粉專（不寫全名；不同意請取消勾選）</span>
        </label>
        <label className="check">
          <input type="checkbox" name="marketing" />
          <span>我願意收到玩學院後續的工作坊與課程資訊（選填）</span>
        </label>
      </fieldset>

      <input className="honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <div className="su-total">
        <span>
          應繳金額
          {payMode === "after_confirm" && !slot?.confirmed && <small>確定開課後才需要匯款</small>}
          {willWait && <small>這個場次名額不足，送出後會登記為候補</small>}
        </span>
        <strong>${money(total)}</strong>
      </div>
      {error && <p className="notice err" role="alert">{error}</p>}
      <button type="submit" className="btn primary su-submit" disabled={sending}>
        {sending ? "送出中…" : willWait ? "登記候補" : "送出報名"}
      </button>
    </form>
  );
}

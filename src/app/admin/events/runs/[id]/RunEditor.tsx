"use client";

import { useState, useTransition } from "react";
import { shrinkImage } from "@/lib/imageShrink";
import { PAY_MODE_LABEL, UNIT_LABEL, WHO_LABEL, type Price, type Question, type Run } from "@/lib/eventTypes";
import type { EvResult } from "../../actions";

// 後台：開課設定（標題、參加方式、價格方案、自訂題目、退費辦法）
export default function RunEditor({ run, defaultRefund, save }: { run: Run; defaultRefund: string; save: (fd: FormData) => Promise<EvResult> }) {
  const [prices, setPrices] = useState<Price[]>(run.prices?.length ? run.prices : [{ key: "p1", label: "單人", amount: 0, seats: 1 }]);
  const [questions, setQuestions] = useState<Question[]>(run.questions ?? []);
  const [img, setImg] = useState<{ blob: Blob; width: number; height: number; url: string } | null>(null);
  const [msg, setMsg] = useState<EvResult | null>(null);
  const [busy, start] = useTransition();
  const nextKey = (prefix: string, list: { key: string }[]) => {
    for (let i = 1; ; i++) if (!list.some((x) => x.key === `${prefix}${i}`)) return `${prefix}${i}`;
  };

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("prices", JSON.stringify(prices));
    fd.set("questions", JSON.stringify(questions));
    fd.delete("picker");
    if (img) {
      fd.set("file", img.blob, "cover.webp");
      fd.set("width", String(img.width));
      fd.set("height", String(img.height));
    }
    start(async () => {
      const r = await save(fd);
      setMsg(r);
      if (r.ok) setImg(null);
    });
  }

  return (
    <form onSubmit={submit} className="adm-panel ev-form" aria-busy={busy}>
      <input type="hidden" name="id" value={run.id} />
      <div className="adm-grid">
        <label className="adm-wide">
          這次的標題（空白就用主題名稱）
          <input name="title" defaultValue={run.title ?? ""} maxLength={80} placeholder="例：7 月份主題【追風小勇士】" />
        </label>
        <label className="adm-wide">
          這次的補充說明（空白就用主題介紹）
          <textarea name="intro" defaultValue={run.intro ?? ""} rows={3} maxLength={800} />
        </label>
        <label>
          誰參加
          <select name="who" defaultValue={run.who}>
            {Object.entries(WHO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>
          名額算
          <select name="unit" defaultValue={run.unit}>
            {Object.entries(UNIT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>
          報名模式
          <select name="pay_mode" defaultValue={run.pay_mode}>
            {Object.entries(PAY_MODE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>
          報名截止日（可不填）
          <input type="date" name="deadline" defaultValue={run.deadline ?? ""} />
        </label>
        <label>
          開課前幾天提醒
          <input type="number" name="reminder_days" min={0} max={14} defaultValue={run.reminder_days} />
        </label>
        <label>
          這次的封面或海報（可不放，空白用主題封面）
          <input
            type="file"
            name="picker"
            accept="image/*"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const out = await shrinkImage(f, 1600);
              setImg({ ...out, url: URL.createObjectURL(out.blob) });
            }}
          />
          {(img?.url || run.cover_url) && <img src={img?.url ?? run.cover_url ?? ""} alt="" className="ev-thumb" />}
        </label>
      </div>

      <h3 className="ev-h">報名方案</h3>
      <p className="hint">「含名額」是一份方案佔幾個名額，例如兩人同行填 2。舊生方案會在報名時提醒老師核對。</p>
      <div className="ev-rows">
        {prices.map((p, i) => (
          <div key={p.key} className="ev-row">
            <input aria-label="方案名稱" value={p.label} placeholder="例：兩人同行" maxLength={40} onChange={(e) => setPrices(prices.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <label className="ev-inline">$<input aria-label="金額" type="number" min={0} value={p.amount || ""} onChange={(e) => setPrices(prices.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))} /></label>
            <label className="ev-inline">含名額<input aria-label="含名額" type="number" min={1} max={20} value={p.seats} onChange={(e) => setPrices(prices.map((x, j) => (j === i ? { ...x, seats: Number(e.target.value) } : x)))} /></label>
            <label className="adm-check"><input type="checkbox" checked={!!p.returning_only} onChange={(e) => setPrices(prices.map((x, j) => (j === i ? { ...x, returning_only: e.target.checked } : x)))} />舊生</label>
            <button type="button" className="adm-link danger" onClick={() => setPrices(prices.filter((_, j) => j !== i))} disabled={prices.length <= 1}>移除</button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-sm" onClick={() => setPrices([...prices, { key: nextKey("p", prices), label: "", amount: 0, seats: 1 }])}>＋ 新增方案</button>

      <h3 className="ev-h">自訂題目（可不加）</h3>
      <p className="hint">例：是否第一次參加、T 恤尺寸、怎麼知道這個活動。</p>
      <div className="ev-rows">
        {questions.map((q, i) => (
          <div key={q.key} className="ev-row">
            <input aria-label="題目" value={q.label} placeholder="題目" maxLength={80} onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <select aria-label="題型" value={q.type} onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, type: e.target.value as Question["type"] } : x)))}>
              <option value="text">文字</option>
              <option value="choice">選項</option>
            </select>
            {q.type === "choice" && (
              <input aria-label="選項" value={(q.options ?? []).join("、")} placeholder="選項用頓號分開" onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, options: e.target.value.split(/[、,，]/) } : x)))} />
            )}
            <label className="adm-check"><input type="checkbox" checked={!!q.required} onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))} />必填</label>
            <button type="button" className="adm-link danger" onClick={() => setQuestions(questions.filter((_, j) => j !== i))}>移除</button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-sm" onClick={() => setQuestions([...questions, { key: nextKey("q", questions), label: "", type: "text", required: false }])}>＋ 新增題目</button>

      <h3 className="ev-h">取消與退費辦法</h3>
      <textarea name="refund_text" defaultValue={run.refund_text ?? ""} rows={6} maxLength={3000} placeholder={`空白就用設定裡的共用範本：\n${defaultRefund.slice(0, 120)}…`} className="ev-full" />

      <div className="ph-actions">
        <button type="submit" className="btn btn-sm primary" disabled={busy}>{busy ? "儲存中…" : "儲存開課設定"}</button>
        {msg && <span className={`ph-msg ${msg.ok ? "ok" : "err"}`} role="status">{msg.message}</span>}
      </div>
    </form>
  );
}

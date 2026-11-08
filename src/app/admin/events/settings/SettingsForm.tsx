"use client";

import { useState, useTransition } from "react";
import type { EvResult } from "../actions";

// 後台：匯款資訊、共用退費辦法、團隊介紹、私訊範本
export default function SettingsForm({
  values,
  templates,
  vars,
  save,
}: {
  values: Record<string, string>;
  templates: { key: string; label: string }[];
  vars: string;
  save: (fd: FormData) => Promise<EvResult>;
}) {
  const [msg, setMsg] = useState<EvResult | null>(null);
  const [busy, start] = useTransition();
  return (
    <form
      className="ev-form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => setMsg(await save(fd)));
      }}
    >
      <fieldset className="adm-panel">
        <legend>匯款資訊</legend>
        <p className="hint">顯示在家長的報名查詢頁與私訊稿。只存在資料庫，不會寫進程式庫。</p>
        <textarea name="bank" defaultValue={values.bank ?? ""} rows={3} className="ev-full" placeholder={"銀行代號：808（玉山銀行）\n帳號：…\n戶名：…"} />
      </fieldset>
      <fieldset className="adm-panel">
        <legend>共用的取消與退費辦法</legend>
        <p className="hint">每次開課沒有另外填寫時，報名頁會顯示這一份。</p>
        <textarea name="refund" defaultValue={values.refund ?? ""} rows={10} className="ev-full" />
      </fieldset>
      <fieldset className="adm-panel">
        <legend>團隊介紹（報名頁下方）</legend>
        <textarea name="team" defaultValue={values.team ?? ""} rows={4} className="ev-full" />
      </fieldset>
      <fieldset className="adm-panel">
        <legend>私訊範本</legend>
        <p className="hint">可以用的變數：{vars}。沒有內容的變數那一行會自動拿掉。</p>
        {templates.map((t) => (
          <label key={t.key} className="ev-tpl">
            {t.label}
            <textarea name={t.key} defaultValue={values[t.key] ?? ""} rows={6} className="ev-full" />
          </label>
        ))}
      </fieldset>
      <div className="ph-actions">
        <button type="submit" className="btn primary" disabled={busy}>{busy ? "儲存中…" : "儲存設定"}</button>
        {msg && <span className={`ph-msg ${msg.ok ? "ok" : "err"}`} role="status">{msg.message}</span>}
      </div>
    </form>
  );
}

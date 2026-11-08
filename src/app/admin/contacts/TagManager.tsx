"use client";

import { useState, useTransition } from "react";
import type { ContactTag } from "@/lib/eventTypes";
import ConfirmButton from "../ConfirmButton";
import { createTag, deleteTag, updateTag, type CtResult } from "./actions";

const COLORS = [
  { v: "gray", l: "灰" },
  { v: "yellow", l: "黃" },
  { v: "green", l: "綠" },
  { v: "red", l: "紅" },
  { v: "blue", l: "藍" },
];

// 後台：手動標籤管理（新增、改名、換顏色、刪除）
export default function TagManager({ tags }: { tags: ContactTag[] }) {
  const [msg, setMsg] = useState<CtResult | null>(null);
  const [busy, start] = useTransition();
  return (
    <details className="ev-details">
      <summary>管理手動標籤（{tags.length}）</summary>
      <div className="adm-panel">
        <p className="hint">自動標籤（參加過的系列、主題、地區、舊生）會依報名紀錄自動產生，不用手動加。這裡管理自己加的標籤，例如：潛力學員、想上主修、團體包班。</p>
        <form
          className="adm-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            start(async () => {
              const r = await createTag(fd);
              setMsg(r);
              if (r.ok) form.reset();
            });
          }}
        >
          <input name="name" placeholder="新標籤名稱" maxLength={20} required />
          <select name="color" defaultValue="yellow">{COLORS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</select>
          <button type="submit" className="btn btn-sm primary" disabled={busy}>新增</button>
          {msg && <span className={`ph-msg ${msg.ok ? "ok" : "err"}`}>{msg.message}</span>}
        </form>
        <ul className="adm-list">
          {tags.map((t) => (
            <li key={`${t.id}-${t.name}-${t.color}`} className="adm-inline-form">
              <input defaultValue={t.name} maxLength={20} id={`tn-${t.id}`} aria-label="標籤名稱" />
              <select defaultValue={t.color} id={`tc-${t.id}`} aria-label="顏色">{COLORS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</select>
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                onClick={() => {
                  const n = (document.getElementById(`tn-${t.id}`) as HTMLInputElement).value;
                  const c = (document.getElementById(`tc-${t.id}`) as HTMLSelectElement).value;
                  start(async () => setMsg(await updateTag(t.id, n, c)));
                }}
              >
                儲存
              </button>
              <ConfirmButton label="刪除" message={`刪除標籤「${t.name}」？`} onConfirm={() => start(async () => setMsg(await deleteTag(t.id)))} />
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

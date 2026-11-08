"use client";

import { useState, useTransition } from "react";
import { GRADES, type ContactTag, type Family } from "@/lib/eventTypes";
import { saveFamily, savePerson, togglePersonTag, type CtResult } from "../actions";

type P = { id: string; name: string; kind: "child" | "adult"; gradeNow: number | null; gradeText: string; stage: string | null; note: string | null; manual: string[]; auto: string[] };

// 後台：家庭聯絡資料、每個人的年級、備註與手動標籤
export default function FamilyForms({ family, tags, people }: { family: Family; tags: ContactTag[]; people: P[] }) {
  const [msg, setMsg] = useState<CtResult | null>(null);
  const [busy, start] = useTransition();
  const submit = (fn: (fd: FormData) => Promise<CtResult>) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => setMsg(await fn(fd)));
  };
  return (
    <>
      {msg && <p className={`notice ${msg.ok ? "ok" : "err"}`} role="status">{msg.message}</p>}
      <form className="adm-panel" onSubmit={submit(saveFamily)}>
        <input type="hidden" name="id" value={family.id} />
        <input type="hidden" name="was_marketing" value={family.marketing ? "1" : "0"} />
        <div className="adm-grid">
          <label>聯絡人<input name="name" defaultValue={family.name} maxLength={40} required /></label>
          <label>電話<input value={family.phone} readOnly /></label>
          <label>Email<input name="email" type="email" defaultValue={family.email ?? ""} maxLength={120} /></label>
          <label>私訊名<input name="social_name" defaultValue={family.social_name ?? ""} maxLength={60} /></label>
          <label className="adm-wide">老師備註<textarea name="note" defaultValue={family.note ?? ""} rows={2} maxLength={500} /></label>
          <label className="adm-check">
            <input type="checkbox" name="marketing" defaultChecked={family.marketing} />
            同意收到後續工作坊與課程資訊{family.marketing_at ? `（${family.marketing_at.slice(0, 10)} 同意）` : ""}
          </label>
          <p className="hint">照片同意（最近一次報名）：{family.photo_ok === false ? "不公開" : "可以公開"}</p>
        </div>
        <button type="submit" className="btn btn-sm primary" disabled={busy}>儲存聯絡資料</button>
      </form>
      {people.map((p) => (
        <form key={p.id} className="adm-panel" onSubmit={submit(savePerson)}>
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="family_id" value={family.id} />
          <div className="adm-grid">
            <label>{p.kind === "adult" ? "成人" : "孩子"}姓名<input name="name" defaultValue={p.name} maxLength={40} required /></label>
            {p.kind === "child" && (
              <label>
                現在的年級（{p.stage ?? "未填"}）
                <select name="grade" defaultValue={p.gradeNow ?? ""}>
                  <option value="">未填</option>
                  {GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </label>
            )}
            <label className="adm-wide">備註<input name="note" defaultValue={p.note ?? ""} maxLength={300} /></label>
          </div>
          <div className="ev-tagpick">
            {tags.map((t) => {
              const on = p.manual.includes(t.id);
              return (
                <button key={t.id} type="button" className={`tag tag-${on ? t.color : "gray"} ${on ? "on" : "off"}`} aria-pressed={on} disabled={busy} onClick={() => start(async () => setMsg(await togglePersonTag(p.id, t.id, !on, family.id)))}>
                  {on ? "✓ " : "＋ "}{t.name}
                </button>
              );
            })}
            {p.auto.map((a) => <span key={a} className="tag tag-gray">{a}</span>)}
          </div>
          <button type="submit" className="btn btn-sm" disabled={busy}>儲存</button>
        </form>
      ))}
    </>
  );
}

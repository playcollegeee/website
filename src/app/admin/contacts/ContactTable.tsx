"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import CopyButton from "@/components/CopyButton";
import type { ContactTag } from "@/lib/eventTypes";
import { bulkTag, type CtResult } from "./actions";

type Row = {
  id: string;
  familyId: string;
  name: string;
  kind: "child" | "adult";
  gradeText: string;
  stage: string | null;
  contact: string;
  phone: string;
  social: string | null;
  marketing: boolean;
  auto: string[];
  manual: ContactTag[];
};

// 後台：名單表格（勾選多人加標籤、複製聯絡清單）
export default function ContactTable({ rows, tags }: { rows: Row[]; tags: ContactTag[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [tagId, setTagId] = useState("");
  const [msg, setMsg] = useState<CtResult | null>(null);
  const [busy, start] = useTransition();
  const all = rows.length > 0 && sel.size === rows.length;
  const picked = rows.filter((r) => sel.has(r.id));
  const source = picked.length ? picked : rows;
  // 複製聯絡清單：同一個家庭只列一次，只列同意收訊息的
  const seen = new Set<string>();
  const list = source
    .filter((r) => r.marketing && !seen.has(r.familyId) && seen.add(r.familyId))
    .map((r) => `${r.contact}\t${r.social ?? ""}\t${r.phone}\t${source.filter((x) => x.familyId === r.familyId).map((x) => x.name).join("、")}`)
    .join("\n");

  function run(mode: "add" | "remove") {
    const fd = new FormData();
    fd.set("tag_id", tagId);
    fd.set("mode", mode);
    for (const id of sel) fd.append("person", id);
    start(async () => setMsg(await bulkTag(fd)));
  }

  return (
    <>
      <div className="adm-panel adm-inline-form">
        <strong>勾選 {sel.size} 人</strong>
        <select value={tagId} onChange={(e) => setTagId(e.target.value)} aria-label="選標籤">
          <option value="">選標籤</option>
          {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button type="button" className="btn btn-sm primary" disabled={busy || !tagId || sel.size === 0} onClick={() => run("add")}>加上標籤</button>
        <button type="button" className="btn btn-sm" disabled={busy || !tagId || sel.size === 0} onClick={() => run("remove")}>拿掉標籤</button>
        <CopyButton text={list} label={`複製聯絡清單（${seen.size} 個同意收訊息的家庭）`} />
        {msg && <span className={`ph-msg ${msg.ok ? "ok" : "err"}`} role="status">{msg.message}</span>}
      </div>
      <div className="adm-scroll">
        <table className="adm-table ev-contacts">
          <thead>
            <tr>
              <th><input type="checkbox" checked={all} aria-label="全選" onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} /></th>
              <th>姓名</th>
              <th>階段</th>
              <th>聯絡人</th>
              <th>標籤</th>
              <th>收訊息</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="adm-empty">沒有符合的人</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" checked={sel.has(r.id)} aria-label={`選 ${r.name}`} onChange={() => { const n = new Set(sel); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); setSel(n); }} /></td>
                <td><Link href={`/admin/contacts/${r.familyId}`} className="adm-strong">{r.name}</Link></td>
                <td>{r.stage ?? ""}<div className="hint">{r.gradeText}</div></td>
                <td>{r.contact}<div className="hint">{r.social ? `私訊名：${r.social}・` : ""}{r.phone}</div></td>
                <td>
                  {r.manual.map((t) => <span key={t.id} className={`tag tag-${t.color}`}>{t.name}</span>)}
                  {r.auto.map((t) => <span key={t} className="tag tag-gray">{t}</span>)}
                </td>
                <td>{r.marketing ? "✓" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

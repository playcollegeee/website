"use client";

import { useOptimistic, useState, useTransition } from "react";
import { LEAD_STATUSES } from "./labels";

// 詢問狀態：選了就自動存檔，標籤立刻變色，不用再按按鈕
export default function LeadStatusForm({
  id,
  status,
  action,
}: {
  id: string;
  status: string;
  action: (fd: FormData) => Promise<void>;
}) {
  const [shown, setShown] = useOptimistic(status);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const st = LEAD_STATUSES.find((s) => s.value === shown);

  function change(next: string) {
    setSaved(false);
    start(async () => {
      setShown(next);
      const fd = new FormData();
      fd.set("id", id);
      fd.set("from", status);
      fd.set("status", next);
      await action(fd);
      setSaved(true);
    });
  }

  return (
    <div className="admin-status">
      <span className={`tag tag-${st?.color ?? "gray"}`}>{st?.label ?? shown}</span>
      <label>
        <span className="sr-only">狀態</span>
        <select value={shown} onChange={(e) => change(e.target.value)} disabled={pending}>
          {LEAD_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <span className="hint" aria-live="polite">
        {pending ? "儲存中…" : saved ? "已更新 ✓" : ""}
      </span>
    </div>
  );
}

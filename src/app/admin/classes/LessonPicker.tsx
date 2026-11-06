"use client";

import { useRef, useState, useTransition } from "react";
import { setSessionLesson } from "../lessons/actions";

export type PickerGroup = { label: string; items: { id: string; title: string; status: string }[] };

// 班級頁每一堂旁邊的「選教案／換教案」。
// 直接呼叫伺服器動作（不用 <form action>），避免 React 送出後把下拉選單重設回第一個選項。
export default function LessonPicker({
  sessionId, current, groups,
}: {
  sessionId: string;
  current: { id: string; title: string; status: string } | null;
  groups: PickerGroup[];
}) {
  const [value, setValue] = useState(current?.id ?? "");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const box = useRef<HTMLDetailsElement>(null);

  const save = () => {
    setErr("");
    const fd = new FormData();
    fd.set("session_id", sessionId);
    fd.set("lesson_id", value);
    start(async () => {
      try {
        await setSessionLesson(fd);
        if (box.current) box.current.open = false;
      } catch (e) {
        setErr(e instanceof Error ? e.message : "儲存失敗");
      }
    });
  };

  return (
    <details className="adm-pop" ref={box}>
      <summary>{current ? "換教案" : "選教案"}</summary>
      <div className="adm-inline-form">
        <select value={value} onChange={(e) => setValue(e.target.value)} aria-label="教案" className="lsn-pick">
          <option value="">（不指定）</option>
          {current && current.status === "archived" && <option value={current.id}>{current.title}（已封存）</option>}
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((l) => <option key={l.id} value={l.id}>{l.title}{l.status === "draft" ? "（草稿）" : ""}</option>)}
            </optgroup>
          ))}
        </select>
        <button className="btn btn-sm" type="button" onClick={save} disabled={pending || value === (current?.id ?? "")}>
          {pending ? "儲存中…" : "儲存"}
        </button>
      </div>
      {err && <p className="notice err">{err}</p>}
    </details>
  );
}

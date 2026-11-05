"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { punch, type PunchState } from "./actions";

// 今日課程頁上方的打卡卡片：外派時用手機打卡，定位是選填（不允許也能打卡）
export default function PunchCard({
  open,
  suggestions,
}: {
  open: { since: string; location: string | null } | null;
  suggestions: string[];
}) {
  const [state, action, pending] = useActionState(punch, {} as PunchState);
  const [locating, setLocating] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const lat = useRef<HTMLInputElement>(null);
  const lng = useRef<HTMLInputElement>(null);
  const acc = useRef<HTMLInputElement>(null);

  // 先取得手機定位（最多等 8 秒），再送出
  const submit = () => {
    if (!form.current?.reportValidity()) return;
    const go = () => {
      setLocating(false);
      form.current?.requestSubmit();
    };
    if (!("geolocation" in navigator)) return go();
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (lat.current) lat.current.value = String(p.coords.latitude);
        if (lng.current) lng.current.value = String(p.coords.longitude);
        if (acc.current) acc.current.value = String(p.coords.accuracy);
        go();
      },
      () => {
        if (lat.current) lat.current.value = "";
        if (lng.current) lng.current.value = "";
        go();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };

  const busy = pending || locating;
  return (
    <form ref={form} action={action} className={`adm-panel adm-punch ${open ? "on" : ""}`}>
      <div className="adm-punch-head">
        <h2>{open ? "上班中" : "老師打卡"}</h2>
        <Link href="/admin/timesheet" className="adm-link">打卡紀錄</Link>
      </div>
      {open ? (
        <p className="hint">
          {new Date(open.since).toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false })} 上班
          {open.location && `・${open.location}`}
        </p>
      ) : (
        <div className="adm-punch-row">
          <input name="location" list="punch-locations" required maxLength={60} placeholder="上班地點（例：玩學院教室、○○國小）" aria-label="上班地點" defaultValue={suggestions[0] ?? ""} />
          <datalist id="punch-locations">
            {suggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
      )}
      <input type="hidden" name="lat" ref={lat} />
      <input type="hidden" name="lng" ref={lng} />
      <input type="hidden" name="acc" ref={acc} />
      <button type="button" className={`btn ${open ? "" : "primary"} adm-punch-btn`} onClick={submit} disabled={busy}>
        {locating ? "取得定位中…" : pending ? "打卡中…" : open ? "下班打卡" : "上班打卡"}
      </button>
      {state.ok && <p className="notice ok" role="status">{state.ok}</p>}
      {state.error && <p className="notice err" role="alert">{state.error}</p>}
      <p className="hint">打卡時間以系統時間為準。手機詢問定位時請按「允許」，方便外派時核對地點；不允許也可以打卡。</p>
    </form>
  );
}

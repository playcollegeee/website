"use client";

import { useState, useTransition } from "react";
import { AREAS, toLocalInput, type Slot } from "@/lib/eventTypes";
import type { EvResult } from "../../actions";

type Row = { date: string; start: string; end: string };

function toRows(slot?: Slot): Row[] {
  if (!slot?.times?.length) return [{ date: "", start: "09:30", end: "12:00" }];
  return slot.times.map((t) => {
    const s = toLocalInput(t.start);
    const e = toLocalInput(t.end);
    return { date: s.slice(0, 10), start: s.slice(11, 16), end: e.slice(11, 16) };
  });
}
// 隔一週同一時間：把最後一天的每一段（上午、下午）都往後複製 7 天
function nextWeek(rows: Row[]): Row[] {
  const last = rows[rows.length - 1];
  if (!last?.date) return [{ ...last }];
  const day = rows.filter((r) => r.date === last.date);
  const d = new Date(`${last.date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  const next = d.toISOString().slice(0, 10);
  return day.map((r) => ({ ...r, date: next }));
}

// 後台：新增／編輯一個場次（地點、名額、上課時間可多天、上下午分段）
export default function SlotEditor({ runId, slot, save, onDone }: { runId: string; slot?: Slot; save: (fd: FormData) => Promise<EvResult>; onDone?: () => void }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(slot));
  const [msg, setMsg] = useState<EvResult | null>(null);
  const [busy, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("times", JSON.stringify(rows.filter((r) => r.date && r.start && r.end).map((r) => ({ start: `${r.date}T${r.start}`, end: `${r.date}T${r.end}` }))));
    start(async () => {
      const r = await save(fd);
      setMsg(r);
      if (r.ok && !slot) {
        form.reset();
        setRows(toRows());
      }
      if (r.ok) onDone?.();
    });
  }

  return (
    <form onSubmit={submit} className="ev-slot-form" aria-busy={busy}>
      <input type="hidden" name="run_id" value={runId} />
      {slot && <input type="hidden" name="id" value={slot.id} />}
      <div className="adm-grid">
        <label>
          場次名稱
          <input name="label" defaultValue={slot?.label ?? ""} placeholder="例：台中場、第一梯" maxLength={40} required />
        </label>
        <label>
          地區
          <select name="area" defaultValue={slot?.area ?? "台中"}>
            {AREAS.map((a) => <option key={a}>{a}</option>)}
            <option value="">其他</option>
          </select>
        </label>
        <label>
          地點名稱
          <input name="venue" defaultValue={slot?.venue ?? ""} placeholder="例：閃亮之星公寓大廈 綜合會議室" maxLength={80} />
        </label>
        <label>
          地址
          <input name="address" defaultValue={slot?.address ?? ""} placeholder="臺中市潭子區中山路二段283巷6號" maxLength={120} />
        </label>
        <label>
          名額
          <input type="number" name="capacity" min={1} max={500} defaultValue={slot?.capacity ?? 6} required />
        </label>
        <label>
          最低開課
          <input type="number" name="min_seats" min={0} max={500} defaultValue={slot?.min_seats ?? 3} />
        </label>
        <label className="adm-check">
          <input type="checkbox" name="waitlist" defaultChecked={slot?.waitlist ?? true} />
          額滿後可以登記候補
        </label>
      </div>
      <p className="ev-sub">上課時間（多天或上下午分開上，就加多段）</p>
      <div className="ev-rows">
        {rows.map((r, i) => (
          <div key={i} className="ev-row">
            <input type="date" aria-label="日期" value={r.date} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} required={i === 0} />
            <input type="time" aria-label="開始" value={r.start} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
            <span>–</span>
            <input type="time" aria-label="結束" value={r.end} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
            <button type="button" className="adm-link danger" onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={rows.length <= 1}>移除</button>
          </div>
        ))}
      </div>
      <div className="adm-btns">
        <button type="button" className="btn btn-sm" onClick={() => setRows([...rows, { ...rows[rows.length - 1], start: "13:30", end: "16:00" }])}>＋ 同一天加一段</button>
        <button type="button" className="btn btn-sm" onClick={() => setRows([...rows, ...nextWeek(rows)])}>＋ 隔週同時間</button>
      </div>
      <div className="ph-actions">
        <button type="submit" className="btn btn-sm primary" disabled={busy}>{busy ? "儲存中…" : slot ? "儲存場次" : "新增場次"}</button>
        {msg && <span className={`ph-msg ${msg.ok ? "ok" : "err"}`} role="status">{msg.message}</span>}
      </div>
    </form>
  );
}

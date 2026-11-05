import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import { OPEN_WINDOW_HOURS, fmtDate, fmtTime, ymd } from "@/lib/admin";
import { saveShift } from "./actions";

export const metadata = { title: "打卡紀錄" };

type Shift = {
  id: string; teacher_id: string; check_in_at: string; check_out_at: string | null;
  source: string; check_out_source: string | null; location: string | null; note: string | null;
  check_in_lat: number | null; check_in_lng: number | null; check_in_accuracy: number | null;
  check_out_lat: number | null; check_out_lng: number | null; check_out_accuracy: number | null;
  edited_at: string | null; teachers: { name: string; nickname: string | null };
};
const SRC: Record<string, string> = { card: "刷卡", online: "線上", manual: "補登" };

// datetime-local 的值（台灣時間）
const local = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 8 * 3600000).toISOString().slice(0, 16) : "");
const mapLink = (lat: number | null, lng: number | null) =>
  lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null;

export default async function TimesheetPage({ searchParams }: { searchParams: Promise<{ m?: string; t?: string }> }) {
  const staff = await requireStaff();
  const { m, t } = await searchParams;
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : ymd().slice(0, 7);
  const [y, mo] = month.split("-").map(Number);
  const start = new Date(`${month}-01T00:00:00+08:00`);
  const nextMonth = `${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, "0")}`;
  const prevMonth = `${mo === 1 ? y - 1 : y}-${String(mo === 1 ? 12 : mo - 1).padStart(2, "0")}`;
  const end = new Date(`${nextMonth}-01T00:00:00+08:00`);

  // 一般老師只能看自己的；管理員可看全部或篩選
  const who = staff.is_admin ? (t && /^[0-9a-f-]{36}$/.test(t) ? t : "") : staff.id;
  const [shifts, teachers] = await Promise.all([
    sbGet<Shift[]>(
      `teacher_attendance?check_in_at=gte.${start.toISOString()}&check_in_at=lt.${end.toISOString()}` +
        `${who ? `&teacher_id=eq.${who}` : ""}&order=check_in_at.desc&select=*,teachers!teacher_attendance_teacher_id_fkey(name,nickname)`,
    ),
    staff.is_admin
      ? sbGet<{ id: string; name: string; nickname: string | null }[]>("teachers?active=eq.true&order=name&select=id,name,nickname")
      : Promise.resolve([]),
  ]);

  const now = Date.now();
  const hoursOf = (s: Shift) => (s.check_out_at ? (new Date(s.check_out_at).getTime() - new Date(s.check_in_at).getTime()) / 3600000 : 0);
  const forgot = (s: Shift) => !s.check_out_at && now - new Date(s.check_in_at).getTime() > OPEN_WINDOW_HOURS * 3600000;
  const totals = new Map<string, { name: string; hours: number; days: Set<string>; missing: number }>();
  for (const s of shifts) {
    const k = s.teacher_id;
    const cur = totals.get(k) ?? { name: s.teachers.nickname ?? s.teachers.name, hours: 0, days: new Set(), missing: 0 };
    cur.hours += hoursOf(s);
    cur.days.add(ymd(new Date(s.check_in_at)));
    if (forgot(s)) cur.missing += 1;
    totals.set(k, cur);
  }
  const q = (mm: string) => `/admin/timesheet?m=${mm}${who && staff.is_admin ? `&t=${who}` : ""}`;

  return (
    <>
      <div className="adm-head">
        <h1>打卡紀錄 <small>{y} 年 {mo} 月</small></h1>
        <div className="adm-actions">
          <Link className="btn btn-sm" href={q(prevMonth)}>← 上個月</Link>
          <Link className="btn btn-sm" href={q(nextMonth)}>下個月 →</Link>
        </div>
      </div>

      {staff.is_admin && (
        <form className="adm-filters">
          <input type="hidden" name="m" value={month} />
          <select name="t" defaultValue={who} aria-label="老師">
            <option value="">全部老師</option>
            {teachers.map((x) => <option key={x.id} value={x.id}>{x.nickname ?? x.name}</option>)}
          </select>
          <button className="btn btn-sm" type="submit">篩選</button>
        </form>
      )}

      <section className="adm-panel">
        <h2>本月合計</h2>
        {totals.size === 0 ? (
          <p className="adm-empty">這個月還沒有打卡紀錄。</p>
        ) : (
          <table className="adm-table">
            <thead><tr><th>老師</th><th>出勤天數</th><th>時數</th><th>未打下班卡</th></tr></thead>
            <tbody>
              {[...totals.values()].map((x) => (
                <tr key={x.name}>
                  <td className="adm-strong">{x.name}</td>
                  <td>{x.days.size} 天</td>
                  <td>{x.hours.toFixed(1)} 小時</td>
                  <td>{x.missing ? <span className="tag tag-red">{x.missing} 筆</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="hint">時數只計算有上下班時間的紀錄。忘記打下班卡的，請管理員在下方修改補上。</p>
      </section>

      {shifts.length > 0 && (
        <div className="adm-scroll">
          <table className="adm-table">
            <thead><tr><th>日期</th>{staff.is_admin && <th>老師</th>}<th>上班</th><th>下班</th><th>時數</th><th>地點</th><th /></tr></thead>
            <tbody>
              {shifts.map((s) => {
                const inMap = mapLink(s.check_in_lat, s.check_in_lng);
                const outMap = mapLink(s.check_out_lat, s.check_out_lng);
                return (
                  <tr key={s.id}>
                    <td>{fmtDate(s.check_in_at)}</td>
                    {staff.is_admin && <td>{s.teachers.nickname ?? s.teachers.name}</td>}
                    <td>
                      {fmtTime(s.check_in_at)} <small>{SRC[s.source]}</small>
                      {inMap && <> <a href={inMap} target="_blank" rel="noopener noreferrer" className="adm-inline">定位{s.check_in_accuracy ? `±${s.check_in_accuracy}m` : ""}</a></>}
                    </td>
                    <td>
                      {s.check_out_at ? (
                        <>
                          {fmtTime(s.check_out_at)} <small>{SRC[s.check_out_source ?? "card"]}</small>
                          {outMap && <> <a href={outMap} target="_blank" rel="noopener noreferrer" className="adm-inline">定位</a></>}
                        </>
                      ) : forgot(s) ? <span className="tag tag-red">未打卡</span> : <span className="tag tag-green">上班中</span>}
                    </td>
                    <td>{s.check_out_at ? hoursOf(s).toFixed(1) : "—"}</td>
                    <td>
                      {s.location ?? "—"}
                      {s.note && <><br /><small>{s.note}</small></>}
                      {s.edited_at && <><br /><small className="muted">管理員修改過</small></>}
                    </td>
                    <td>
                      {staff.is_admin && (
                        <details className="adm-pop">
                          <summary>修改</summary>
                          <form action={saveShift} className="adm-shift-form">
                            <input type="hidden" name="id" value={s.id} />
                            <label>上班<input type="datetime-local" name="check_in_at" required defaultValue={local(s.check_in_at)} /></label>
                            <label>下班<input type="datetime-local" name="check_out_at" defaultValue={local(s.check_out_at)} /></label>
                            <label>地點<input name="location" defaultValue={s.location ?? ""} maxLength={60} /></label>
                            <label>備註<input name="note" defaultValue={s.note ?? ""} maxLength={200} placeholder="修改原因" /></label>
                            <button className="btn btn-sm" type="submit">儲存</button>
                          </form>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {staff.is_admin && (
        <form action={saveShift} className="adm-panel adm-form">
          <h2>補登一筆</h2>
          <div className="adm-grid">
            <div className="field">
              <label htmlFor="sh-t">老師</label>
              <select id="sh-t" name="teacher_id" required defaultValue={who}>
                <option value="" disabled>請選擇</option>
                {teachers.map((x) => <option key={x.id} value={x.id}>{x.nickname ?? x.name}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="sh-in">上班</label><input id="sh-in" type="datetime-local" name="check_in_at" required /></div>
            <div className="field"><label htmlFor="sh-out">下班</label><input id="sh-out" type="datetime-local" name="check_out_at" /></div>
            <div className="field"><label htmlFor="sh-loc">地點</label><input id="sh-loc" name="location" maxLength={60} /></div>
            <div className="field adm-wide"><label htmlFor="sh-note">備註</label><input id="sh-note" name="note" maxLength={200} placeholder="例：忘記打卡，老師口頭回報" /></div>
          </div>
          <button className="btn btn-sm" type="submit">補登</button>
        </form>
      )}
    </>
  );
}

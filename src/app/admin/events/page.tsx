import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import { fmtTimes, money, RUN_STATUS_LABEL, runTitle, slotsWithUsage, UNIT_LABEL, type Run, type Theme } from "@/lib/events";
import { createRun } from "./actions";
import { loadQueue } from "./data";

export const metadata = { title: "活動報名" };

// 後台：活動報名首頁（開課列表、新增開課、待辦）
export default async function EventsHome({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  await requireStaff(true);
  const { err } = await searchParams;
  let runs: Run[] = [];
  let themes: Theme[] = [];
  let error = "";
  try {
    [runs, themes] = await Promise.all([
      sbGet<Run[]>("activity_runs?select=*&order=created_at.desc&limit=100"),
      sbGet<Theme[]>("activity_themes?select=*&order=sort,created_at"),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "讀取失敗";
  }
  if (error) {
    return (
      <>
        <h1>活動報名</h1>
        <div className="notice err">{error}。如果是第一次使用，請先在 Supabase 執行 <code>supabase/migrations/0016_activity_signup.sql</code>。</div>
      </>
    );
  }
  const [slots, { queue, settings }, bookings, interests] = await Promise.all([
    slotsWithUsage(runs.map((r) => r.id)),
    loadQueue(),
    sbGet<{ run_id: string; status: string; amount: number; pay_last5: string | null }[]>(
      `activity_bookings?run_id=in.(${runs.map((r) => r.id).join(",") || "00000000-0000-0000-0000-000000000000"})&select=run_id,status,amount,pay_last5`,
    ),
    sbGet<{ theme_id: string; headcount: number }[]>("activity_interests?status=eq.new&select=theme_id,headcount"),
  ]);
  const tm = new Map(themes.map((t) => [t.id, t]));
  const toVerify = bookings.filter((b) => b.status === "pending" && b.pay_last5).length;
  const interestBy = new Map<string, number>();
  for (const i of interests) interestBy.set(i.theme_id, (interestBy.get(i.theme_id) ?? 0) + i.headcount);
  const ready = [...interestBy.entries()].filter(([, n]) => n >= 3);
  const groups: { title: string; list: Run[] }[] = [
    { title: "報名中", list: runs.filter((r) => r.status === "open") },
    { title: "草稿（還沒開放）", list: runs.filter((r) => r.status === "draft") },
    { title: "停止報名", list: runs.filter((r) => r.status === "closed") },
    { title: "已結束", list: runs.filter((r) => r.status === "done") },
  ];

  return (
    <>
      <div className="adm-head">
        <h1>活動報名</h1>
        <div className="adm-actions">
          <Link className="btn btn-sm primary" href="/admin/events/messages">💬 要傳的私訊{queue.length > 0 ? `（${queue.length}）` : ""}</Link>
          <Link className="btn btn-sm" href="/admin/events/themes">主題與工作坊總覽</Link>
          <Link className="btn btn-sm" href="/admin/events/interests">我想上這堂{interests.length > 0 ? `（${interests.length}）` : ""}</Link>
          <Link className="btn btn-sm" href="/admin/contacts">活動名單</Link>
          <Link className="btn btn-sm" href="/admin/events/settings">設定</Link>
        </div>
      </div>
      <p className="hint">
        流程：建立開課 → 填場次與方案 → 開放報名 → 家長報名、匯款、回填末五碼 → 這裡對帳按「確認收款」→ 到「要傳的私訊」複製訊息貼到粉專。
      </p>
      {err && <p className="notice err">{err}</p>}
      {!settings.bank?.trim() && <p className="adm-warn">⚠ 還沒有填匯款資訊，請先到 <Link href="/admin/events/settings">設定</Link> 填寫。</p>}
      {toVerify > 0 && <p className="notice ok">有 {toVerify} 筆報名已回填匯款末五碼，等你對帳。</p>}
      {ready.length > 0 && (
        <p className="notice ok">
          🎉 湊班達標：{ready.map(([id, n]) => `${tm.get(id)?.title ?? ""}（${n} 人）`).join("、")}，可以開課了！<Link href="/admin/events/interests" className="adm-inline">看名單 →</Link>
        </p>
      )}

      <form action={createRun} className="adm-panel adm-inline-form">
        <strong>新增開課</strong>
        <select name="theme_id" required defaultValue="">
          <option value="" disabled>選擇主題</option>
          {themes.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <input name="title" placeholder="這次的標題（可不填）" maxLength={80} />
        <button type="submit" className="btn btn-sm primary">建立</button>
        <span className="hint">會沿用同一主題上一次的方案、題目和地點。主題不在清單裡？先到 <Link href="/admin/events/themes">主題</Link> 新增。</span>
      </form>

      {groups.map((g) =>
        g.list.length === 0 ? null : (
          <section key={g.title}>
            <h2 className="ph-h">{g.title}（{g.list.length}）</h2>
            <div className="adm-scroll">
              <table className="adm-table">
                <thead>
                  <tr><th>活動</th><th>場次與名額</th><th>待對帳</th><th>已收款</th></tr>
                </thead>
                <tbody>
                  {g.list.map((r) => {
                    const t = tm.get(r.theme_id);
                    const ss = slots.filter((s) => s.run_id === r.id);
                    const bs = bookings.filter((b) => b.run_id === r.id);
                    return (
                      <tr key={r.id}>
                        <td>
                          <Link href={`/admin/events/runs/${r.id}`} className="adm-strong">{t ? runTitle(r, t) : r.title}</Link>
                          <div className="hint">{RUN_STATUS_LABEL[r.status]}</div>
                        </td>
                        <td>
                          {ss.length === 0 && <span className="hint">還沒有場次</span>}
                          {ss.map((s) => (
                            <div key={s.id}>
                              {s.label} <strong>{s.used}/{s.capacity}</strong>{UNIT_LABEL[r.unit]}
                              {s.state === "confirmed" && <span className="tag tag-green">確定開課</span>}
                              {s.state === "cancelled" && <span className="tag tag-red">停課</span>}
                              <span className="hint"> {fmtTimes(s.times).split("；")[0]}</span>
                            </div>
                          ))}
                        </td>
                        <td>{bs.filter((b) => b.status === "pending" && b.pay_last5).length || ""}</td>
                        <td>${money(bs.filter((b) => b.status === "paid").reduce((s, b) => s + b.amount, 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ),
      )}
      {runs.length === 0 && <p className="adm-empty">還沒有開課。先從上面選一個主題建立。</p>}
    </>
  );
}

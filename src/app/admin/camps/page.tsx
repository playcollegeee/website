import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import { loadPrograms, lastDayOf, menuVisible, fmtMd, SEASON_ICON, todayTw, type CampSeason } from "@/lib/camps";
import { createSeason } from "./actions";

export const metadata = { title: "冬夏令營頁面" };

// 後台：冬夏令營頁面（每一季一頁：2027 冬令營、2027 夏令營…）
export default async function CampsHome({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  await requireStaff(true);
  const { err } = await searchParams;
  let seasons: CampSeason[] = [];
  try {
    seasons = await sbGet<CampSeason[]>("camp_seasons?select=*&order=year.desc,season.asc");
  } catch (e) {
    return (
      <>
        <h1>冬夏令營頁面</h1>
        <div className="notice err">
          {e instanceof Error ? e.message : "讀取失敗"}。如果是第一次使用，請先在 Supabase 執行 <code>supabase/migrations/0022_camps.sql</code>。
        </div>
      </>
    );
  }
  const today = todayTw();
  const rows = await Promise.all(
    seasons.map(async (s) => {
      const ps = await loadPrograms(s.id, false).catch(() => []);
      return { s, n: ps.length, open: ps.filter((p) => p.run?.status === "open").length, last: lastDayOf(ps) };
    }),
  );
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  // 預設建下一個要宣傳的營隊：5～12 月建明年冬令營、1～4 月建今年夏令營
  const defYear = m >= 5 ? y + 1 : y;
  const defSeason = m >= 5 ? "winter" : "summer";

  return (
    <>
      <div className="adm-head">
        <h1>冬夏令營頁面</h1>
        <div className="adm-actions">
          <Link className="btn btn-sm" href="/camp" target="_blank">看官網營隊頁 ↗</Link>
        </div>
      </div>
      <p className="hint">
        流程：先在「課程規劃」排好每一梯的日期與每天的內容 → 這裡建一季、一鍵帶入營隊（自動建好報名草稿）→ 補介紹與封面 →
        到「活動報名」填金額、開放報名 → 按「發布」。頂端選單會在「開始宣傳」那天自動出現冬夏令營入口，最後一梯結束後自動收起。
      </p>
      {err && <p className="notice err">{err}</p>}

      <form action={createSeason} className="adm-panel adm-inline-form">
        <strong>新增一季</strong>
        <select name="year" defaultValue={defYear}>
          {[y - 1, y, y + 1, y + 2].map((v) => (
            <option key={v} value={v}>{v} 年</option>
          ))}
        </select>
        <select name="season" defaultValue={defSeason}>
          <option value="winter">❄️ 冬令營</option>
          <option value="summer">☀️ 夏令營</option>
        </select>
        <button type="submit" className="btn btn-sm primary">建立</button>
        <span className="hint">一天流程、家長 Q&A、要帶什麼會沿用上一季。</span>
      </form>

      {rows.length === 0 ? (
        <p className="adm-empty">還沒有營隊頁面。從上面建立第一季吧！</p>
      ) : (
        <div className="adm-scroll">
          <table className="adm-table">
            <thead>
              <tr><th>營隊</th><th>狀態</th><th>頂端選單</th><th>營隊數</th><th>最後一天</th></tr>
            </thead>
            <tbody>
              {rows.map(({ s, n, open, last }) => {
                const shown = menuVisible(s, last, today);
                return (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/admin/camps/${s.id}`} className="adm-strong">{SEASON_ICON[s.season]} {s.title}</Link>
                      <div className="hint">/camp/{s.slug}</div>
                    </td>
                    <td>{s.status === "published" ? <span className="tag tag-green">已發布</span> : <span className="tag">草稿</span>}</td>
                    <td>
                      {shown ? <span className="tag tag-green">顯示中</span> : <span className="hint">未顯示</span>}
                      {s.menu_mode === "auto" && s.promo_from && !shown && today < s.promo_from && (
                        <div className="hint">{fmtMd(s.promo_from)} 起自動出現</div>
                      )}
                    </td>
                    <td>{n}（報名中 {open}）</td>
                    <td>{last ? fmtMd(last) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

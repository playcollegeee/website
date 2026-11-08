import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import type { Interest, Theme } from "@/lib/events";
import ActBtn from "../ActBtn";
import { createRun, setInterestStatus } from "../actions";

export const metadata = { title: "我想上這堂" };

const fmt = (iso: string) => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric" }).format(new Date(iso));

// 後台：官網「我想上這堂」湊班登記，同一主題累計 3 人以上就提醒開課
export default async function InterestsPage() {
  await requireStaff(true);
  const [list, themes] = await Promise.all([
    sbGet<Interest[]>("activity_interests?select=*&order=created_at.desc&limit=500"),
    sbGet<Theme[]>("activity_themes?select=id,title,slug&order=sort"),
  ]);
  const groups = themes
    .map((t) => {
      const items = list.filter((i) => i.theme_id === t.id);
      return { t, items, waiting: items.filter((i) => i.status === "new").reduce((s, i) => s + i.headcount, 0) };
    })
    .filter((g) => g.items.length > 0)
    .sort((a, b) => b.waiting - a.waiting);

  return (
    <>
      <p className="hint"><Link href="/admin/events">← 活動報名</Link></p>
      <h1>我想上這堂</h1>
      <p className="hint">家長在官網工作坊頁面留下的湊班登記。累計 3 人以上就可以開課；開課後到報名頁複製網址私訊給他們，再按「已通知」。</p>
      {groups.length === 0 && <p className="adm-empty">還沒有人登記。</p>}
      {groups.map(({ t, items, waiting }) => (
        <section key={t.id} className="adm-panel">
          <div className="adm-head">
            <h2>
              {t.title} <span className={`tag ${waiting >= 3 ? "tag-green" : "tag-gray"}`}>等待中 {waiting} 人{waiting >= 3 ? "・可以開課了" : ""}</span>
            </h2>
            <form action={createRun}>
              <input type="hidden" name="theme_id" value={t.id} />
              <button className="btn btn-sm primary">幫這個主題開課</button>
            </form>
          </div>
          <div className="adm-scroll">
            <table className="adm-table">
              <thead><tr><th>登記日</th><th>聯絡人</th><th>人數與參加者</th><th>方便的時間</th><th>狀態</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className={i.status !== "new" ? "ev-dim" : ""}>
                    <td>{fmt(i.created_at)}</td>
                    <td>
                      {i.contact_name}・<a href={`tel:${i.phone}`}>{i.phone}</a>
                      {i.social_name && <div className="hint">私訊名：{i.social_name}</div>}
                      {i.email && <div className="hint">{i.email}</div>}
                    </td>
                    <td>{i.headcount} 人{i.who_text ? `・${i.who_text}` : ""}</td>
                    <td>{i.prefer_text}</td>
                    <td className="adm-btns">
                      {i.status === "new" ? (
                        <>
                          <ActBtn run={setInterestStatus.bind(null, i.id, "notified")} label="已通知" />
                          <ActBtn run={setInterestStatus.bind(null, i.id, "closed")} label="不用了" className="adm-link" />
                        </>
                      ) : (
                        <ActBtn run={setInterestStatus.bind(null, i.id, "new")} label={i.status === "notified" ? "已通知（改回）" : "已結案（改回）"} className="adm-link" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="hint">也可以到 <Link href="/workshops/all" target="_blank">官網工作坊總覽 ↗</Link> 看家長看到的樣子。</p>
    </>
  );
}

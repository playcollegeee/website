import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getShowcaseThemes, SHOWCASE_LABEL, SHOWCASE_LEAD } from "@/lib/events";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "工作坊總覽",
  description: "玩學院開過的 3D 造物工作坊與幼兒主題活動。想上哪一堂，湊到 3 人就可以開課。",
};

// 官網：所有開過的工作坊（分 3D 造物工作坊、幼兒主題活動），主題在後台「活動報名 → 主題」管理
export default async function WorkshopGalleryPage() {
  const { themes, openRunThemeIds } = await getShowcaseThemes();
  const groups = (["3d", "kids"] as const).map((k) => ({ key: k, items: themes.filter((t) => t.showcase === k) })).filter((g) => g.items.length > 0);

  return (
    <>
      <section>
        <div className="container">
          <p className="eyebrow">工作坊總覽</p>
          <h1>開過的工作坊，都可以再開</h1>
          <p className="lead">每個主題都是老師親手設計的。看到想上的，按「我想上這堂」留下聯絡方式，湊到 3 人以上就為你們開課。</p>
          <nav className="btn-row" aria-label="分類">
            {groups.map((g) => (
              <a key={g.key} href={`#${g.key}`} className="btn">{SHOWCASE_LABEL[g.key]}</a>
            ))}
            <Link href="/workshops" className="btn">正在報名的活動</Link>
          </nav>
        </div>
      </section>
      {groups.length === 0 && (
        <section><div className="container"><p className="lead">工作坊整理中，請先看看<Link href="/workshops">正在報名的活動</Link>。</p></div></section>
      )}
      {groups.map((g, gi) => (
        <section key={g.key} id={g.key} className={gi % 2 === 0 ? "bg-yellow" : ""}>
          <div className="container">
            <div className="section-head">
              <h2>{SHOWCASE_LABEL[g.key]}</h2>
              <p className="lead">{SHOWCASE_LEAD[g.key]}</p>
            </div>
            <div className="grid cols-2">
              {g.items.map((t) => (
                <Link key={t.id} href={`/workshops/${t.slug}`} className="card wk-card">
                  {t.cover_url && (
                    <div className="card-img wk-cover">
                      <Image src={t.cover_url} alt={`${t.title}活動照片`} width={800} height={600} sizes="(max-width: 860px) 100vw, 560px" />
                    </div>
                  )}
                  <p className="act-badges">
                    {t.series && <span className="act-badge">{t.series}</span>}
                    {openRunThemeIds.has(t.id) && <span className="act-badge wk-open">報名中</span>}
                  </p>
                  <h3>{t.title}</h3>
                  {t.audience_text && <p><strong>適合對象：</strong>{t.audience_text}</p>}
                  <p>{t.summary}</p>
                  <span className="wk-more">看照片與介紹 →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}

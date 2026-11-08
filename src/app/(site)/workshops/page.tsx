import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AUDIENCE_GROUPS, AUDIENCE_LABEL, KIND_LABEL, getPublishedActivities, signupHref } from "@/lib/activities";

export const metadata: Metadata = {
  title: "活動與工作坊",
  description: "積木故事屋、樂高動滋動、3D 造物體驗工作坊、寒暑假營隊，以及給大人的課程與講座。",
};

// 活動內容在後台「活動與工作坊」管理
export default async function WorkshopsPage() {
  const all = await getPublishedActivities();
  const groups = AUDIENCE_GROUPS.map((g) => ({ ...g, items: all.filter((a) => g.audiences.includes(a.audience)) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <>
      <section>
        <div className="container">
          <p className="eyebrow">活動與工作坊</p>
          <h1>從一次體驗開始</h1>
          <p className="lead">每月都有新主題。在一次活動裡，從想法、設計到完成作品，帶著成就感回家。</p>
          {groups.length > 1 && (
            <nav className="btn-row" aria-label="活動分類">
              {groups.map((g, i) => (
                <a key={g.title} href={`#group-${i}`} className="btn">
                  {g.title}
                </a>
              ))}
            </nav>
          )}
        </div>
      </section>

      {groups.map((g, gi) => (
        <section key={g.title} id={`group-${gi}`} className={gi % 2 === 0 ? "bg-yellow" : ""}>
          <div className="container">
            {groups.length > 1 && (
              <div className="section-head">
                <h2>{g.title}</h2>
                <p className="lead">{g.lead}</p>
              </div>
            )}
            <div className="grid cols-2">
              {g.items.map((a) => {
                const href = signupHref(a);
                const external = a.signup === "link";
                return (
                  <article key={a.id} className="card act-card">
                    {a.image_url && (
                      <div className="card-img">
                        <Image src={a.image_url} alt={`${a.title}活動照片`} width={a.width} height={a.height} sizes="(max-width: 860px) 100vw, 560px" />
                      </div>
                    )}
                    <p className="act-badges">
                      <span className={`act-badge aud-${a.audience}`}>{AUDIENCE_LABEL[a.audience]}</span>
                      <span className="act-badge">{KIND_LABEL[a.kind]}</span>
                    </p>
                    <h3>{a.title}</h3>
                    {a.audience_text && (
                      <p>
                        <strong>適合對象：</strong>
                        {a.audience_text}
                      </p>
                    )}
                    <p>{a.summary}</p>
                    {a.schedule_text && (
                      <p>
                        <strong>時間：</strong>
                        {a.schedule_text}
                      </p>
                    )}
                    {a.price_text && (
                      <p>
                        <strong>費用：</strong>
                        {a.price_text}
                      </p>
                    )}
                    {a.tags.length > 0 && (
                      <div className="act-tags">
                        {a.tags.map((t) => (
                          <span key={t} className="tag">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {href && (
                      <div className="btn-row act-cta">
                        {external ? (
                          <a href={href} className="btn primary" target="_blank" rel="noopener noreferrer">
                            我要報名 ↗
                          </a>
                        ) : (
                          <Link href={href} className="btn primary">
                            詢問與報名
                          </Link>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ))}

      <section>
        <div className="container">
          <h2>想知道下一場在什麼時候？</h2>
          <p className="lead">留下聯絡方式，新活動公布時我們會第一時間通知你。</p>
          <div className="btn-row">
            <Link href="/contact?type=workshop" className="btn primary">
              留下聯絡方式
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

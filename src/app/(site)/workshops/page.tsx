import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AUDIENCE_GROUPS, AUDIENCE_LABEL, KIND_LABEL, getPublishedActivities, signupHref } from "@/lib/activities";
import { fmtTimes, getOpenRuns, runTitle } from "@/lib/events";

export const metadata: Metadata = {
  title: "活動與工作坊",
  description: "積木故事屋、樂高動滋動、3D 造物體驗工作坊、寒暑假營隊，以及給大人的課程與講座。",
};

export const dynamic = "force-dynamic"; // 正在報名的名額要即時

// 活動內容在後台「活動與工作坊」管理
export default async function WorkshopsPage() {
  const [all, openRuns] = await Promise.all([getPublishedActivities(), getOpenRuns().catch(() => [])]);
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
          <nav className="btn-row" aria-label="活動分類">
            {openRuns.length > 0 && <a href="#open" className="btn primary">正在報名</a>}
            {groups.length > 1 &&
              groups.map((g, i) => (
                <a key={g.title} href={`#group-${i}`} className="btn">
                  {g.title}
                </a>
              ))}
            <Link href="/workshops/all" className="btn">工作坊總覽</Link>
          </nav>
        </div>
      </section>

      {openRuns.length > 0 && (
        <section id="open" className="bg-blue">
          <div className="container">
            <div className="section-head">
              <h2>正在報名</h2>
              <p className="lead">名額有限，報名後依指示匯款，並私訊粉專「已報名」。</p>
            </div>
            <div className="grid cols-2">
              {openRuns.map(({ run, theme, slots }) => {
                const cover = run.cover_url || theme.cover_url;
                return (
                  <article key={run.id} className="card act-card">
                    {cover && (
                      <div className="card-img wk-cover">
                        <Image src={cover} alt={`${theme.title}活動照片`} width={800} height={600} sizes="(max-width: 860px) 100vw, 560px" />
                      </div>
                    )}
                    <h3>{runTitle(run, theme)}</h3>
                    {theme.audience_text && (
                      <p>
                        <strong>適合對象：</strong>
                        {theme.audience_text}
                      </p>
                    )}
                    <ul className="wk-slots">
                      {slots.map((s) => (
                        <li key={s.id}>
                          <strong>{s.label}</strong> {fmtTimes(s.times)}
                          <span className={`su-left ${s.left <= 0 ? "full" : ""}`}>{s.left <= 0 ? "額滿・可候補" : s.left <= 3 ? `剩 ${s.left}` : "可報名"}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="btn-row act-cta">
                      <Link href={`/signup/${run.id}`} className="btn primary">我要報名</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

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
          <h2>想上以前開過的工作坊？</h2>
          <p className="lead">看看所有開過的主題，按「我想上這堂」，湊到 3 人就開課。</p>
          <div className="btn-row">
            <Link href="/workshops/all" className="btn primary">
              工作坊總覽
            </Link>
            <Link href="/contact?type=workshop" className="btn">
              留下聯絡方式
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

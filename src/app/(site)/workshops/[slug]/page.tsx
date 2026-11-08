import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import InterestForm from "@/components/InterestForm";
import { fmtTimes, getThemeBySlug, runTitle, SHOWCASE_LABEL } from "@/lib/events";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await getThemeBySlug(slug).catch(() => null);
  if (!d) return { title: "工作坊" };
  return { title: d.theme.title, description: d.theme.summary };
}

// 官網：一個工作坊主題的介紹頁（照片、特色、正在報名的場次、我想上這堂）
export default async function ThemePage({ params }: Props) {
  const { slug } = await params;
  const d = await getThemeBySlug(slug).catch(() => null);
  if (!d) notFound();
  const { theme, photos, runs } = d;

  return (
    <>
      <section>
        <div className="container">
          <p className="eyebrow">
            <Link href="/workshops/all">工作坊總覽</Link>
            {theme.showcase !== "none" && <> ／ {SHOWCASE_LABEL[theme.showcase]}</>}
            {theme.series && <> ／ {theme.series}</>}
          </p>
          <h1>{theme.title}</h1>
          <p className="lead">{theme.summary}</p>
          <div className="btn-row">
            {runs.length > 0 ? (
              <a href="#runs" className="btn primary">報名中，看場次</a>
            ) : (
              <a href="#interest" className="btn primary">我想上這堂</a>
            )}
          </div>
        </div>
      </section>

      {photos.length > 0 && (
        <section className="wk-photos-sec">
          <div className="container">
            <div className="wk-photos">
              {photos.map((p, i) => (
                <figure key={p.id} className={i === 0 ? "wk-photo wk-photo-main" : "wk-photo"}>
                  <Image src={p.url} alt={`${theme.title}活動照片 ${i + 1}`} width={p.width} height={p.height} sizes={i === 0 ? "(max-width: 860px) 100vw, 640px" : "(max-width: 860px) 50vw, 300px"} />
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-yellow">
        <div className="container wk-detail">
          <div>
            {theme.highlights.length > 0 && (
              <>
                <h2>這次會玩什麼？</h2>
                <ul className="su-highlights">
                  {theme.highlights.map((h) => <li key={h}>{h}</li>)}
                </ul>
              </>
            )}
          </div>
          <dl className="su-facts card">
            {theme.audience_text && (<div><dt>適合對象</dt><dd>{theme.audience_text}</dd></div>)}
            {theme.duration_text && (<div><dt>時間長度</dt><dd>{theme.duration_text}</dd></div>)}
            {theme.includes_text && (<div><dt>費用包含</dt><dd>{theme.includes_text}</dd></div>)}
            {theme.notes_text && (<div><dt>備註</dt><dd>{theme.notes_text}</dd></div>)}
          </dl>
        </div>
      </section>

      {runs.length > 0 && (
        <section id="runs">
          <div className="container">
            <h2>正在報名</h2>
            <div className="grid cols-2">
              {runs.map(({ run, slots }) => (
                <article key={run.id} className="card">
                  <h3>{runTitle(run, theme)}</h3>
                  <ul className="wk-slots">
                    {slots.map((s) => (
                      <li key={s.id}>
                        <strong>{s.label}</strong> {fmtTimes(s.times)}
                        <span className={`su-left ${s.left <= 0 ? "full" : ""}`}>{s.left <= 0 ? "額滿・可候補" : s.left <= 3 ? `剩 ${s.left}` : "可報名"}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="btn-row"><Link href={`/signup/${run.id}`} className="btn primary">我要報名</Link></div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="interest" className={runs.length > 0 ? "bg-blue" : ""}>
        <div className="container su-narrow">
          <h2>{runs.length > 0 ? "這些時間都不行？" : "我想上這堂"}</h2>
          <p className="lead">留下聯絡方式和方便的時間。同一個主題湊到 3 人以上，我們就為你們開一班；學校、親子館想包班也歡迎。</p>
          <InterestForm themeId={theme.id} themeTitle={theme.title} />
        </div>
      </section>
    </>
  );
}

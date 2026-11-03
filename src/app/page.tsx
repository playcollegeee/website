import Image from "next/image";
import Link from "next/link";
import AvatarPreview from "@/components/AvatarPreview";
import { featured, highlights, levels, majors, partners, site, stats, valueProps } from "@/lib/content";

const gallery = [
  { src: "/images/croc.webp", alt: "幼兒積木作品：大嘴鱷魚", w: 640, h: 404 },
  { src: "/images/walker.webp", alt: "SPIKE 程式作品：走路機器人", w: 472, h: 640 },
  { src: "/images/f1.webp", alt: "幼兒積木作品：F1 賽車", w: 640, h: 473 },
  { src: "/images/catapult.webp", alt: "SPIKE 動力作品：投石器", w: 640, h: 478 },
];

export default function HomePage() {
  return (
    <>
      {/* 1. 首屏 */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">台中・兒童 STEAM 探索學院</p>
            <h1>
              透過<span>玩</span>，
              <br />
              找到孩子喜歡的事
            </h1>
            <p className="lead">{site.tagline}</p>
            <p className="lead">
              LEGO 樂高機器人、3D 列印造物、美術創作，從幼兒園到國高中，孩子可以一路探索、一路深入，累積屬於自己的作品。
            </p>
            <div className="btn-row">
              <Link href="/contact" className="btn primary">
                預約試聽
              </Link>
              <Link href="/courses" className="btn">
                看課程介紹
              </Link>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="blob" />
            <Image className="a" src="/images/croc.webp" alt="" width={640} height={404} priority />
            <Image className="b" src="/images/walker.webp" alt="" width={472} height={640} priority />
          </div>
        </div>
      </section>

      {/* 2. 數據帶 */}
      <section className="stats-band">
        <div className="container stats">
          {stats.map((s) => (
            <div key={s.label} className="stat">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. 為什麼選玩學院 */}
      <section>
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">為什麼選玩學院</p>
            <h2>讓興趣成為孩子持續學習的動力</h2>
          </div>
          <div className="grid cols-3">
            {valueProps.map((v, i) => (
              <div key={v.title} className="value">
                <div className={`value-num n-${v.color}`}>{i + 1}</div>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </div>
            ))}
          </div>
          <div className="btn-row">
            <Link href="/about" className="btn">
              認識玩學院
            </Link>
          </div>
        </div>
      </section>

      {/* 4. 主打課程 */}
      <section className="bg-yellow">
        <div className="container featured">
          <div className="featured-img">
            <Image src={featured.image} alt={`${featured.name}作品範例`} width={640} height={404} />
          </div>
          <div>
            <p className="eyebrow">第一次來？從這裡開始</p>
            <h2>{featured.name}</h2>
            <p className="lead">{featured.summary}</p>
            <dl className="facts">
              {featured.facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
            <div className="btn-row">
              <Link href={featured.href} className="btn primary">
                預約體驗
              </Link>
              <Link href="/workshops" className="btn">
                其他活動
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 三大主修 */}
      <section>
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">三大主修</p>
            <h2>選一個主修，持續往深處走</h2>
            <p className="lead">一期一選，每期結束可以續讀，也可以換一個主修試試看。</p>
          </div>
          <div className="grid cols-3">
            {majors.map((m) => (
              <Link key={m.slug} href={`/courses#${m.slug}`} className={`card bar-${m.color}`} style={{ textDecoration: "none" }}>
                <h3>{m.name}</h3>
                <p>{m.intro}</p>
                <span className="tag">{m.from}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 6. 五階段 */}
      <section className="bg-green">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">五階段分班</p>
            <h2>依成長階段分班，每一階段都能探索</h2>
          </div>
          <div className="levels">
            {levels.map((l, i) => (
              <div key={l.slug} className={`level ${l.color}`}>
                <div className="step">STEP {i + 1}</div>
                <h3>{l.name}</h3>
                <div className="grades">{l.grades}</div>
                <p>{l.focus}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. 成果與活動紀錄 */}
      <section>
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">成果與活動紀錄</p>
            <h2>孩子們最近做了什麼</h2>
          </div>
          <div className="grid cols-3">
            {highlights.map((h) => (
              <article key={h.title} className={`card bar-${h.color}`}>
                <span className="tag">{h.date}</span>
                <h3>{h.title}</h3>
                <p>{h.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 8. 作品牆 */}
      <section className="bg-yellow">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">作品牆</p>
            <h2>每一個作品，都是孩子自己動手完成的</h2>
          </div>
          <div className="mosaic">
            {gallery.map((g) => (
              <figure key={g.src} className="mosaic-item">
                <Image src={g.src} alt={g.alt} width={g.w} height={g.h} />
                <figcaption>{g.alt}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* 9. 角色養成 */}
      <section className="bg-blue">
        <div className="container avatar-wrap">
          <div style={{ display: "flex", justifyContent: "center" }}>
            <AvatarPreview />
          </div>
          <div>
            <p className="eyebrow">即將推出・玩學院角色養成</p>
            <h2>每上一堂課，角色就解鎖一件裝備</h2>
            <p className="lead">
              每位學生都有一個專屬的積木角色。上課刷卡簽到，就能累積經驗值、解鎖裝備與技能；完成一個系列，還會獲得專屬稱號。
            </p>
            <ul className="loot">
              <li>
                <span className="dot" style={{ background: "var(--red)" }} />
                LEGO 主修：機關工程師路線
              </li>
              <li>
                <span className="dot" style={{ background: "var(--green)" }} />
                3D 造物主修：造物工匠路線
              </li>
              <li>
                <span className="dot" style={{ background: "var(--blue)" }} />
                美術主修：色彩魔法師路線
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 10. 合作單位 */}
      <section className="partners">
        <div className="container">
          <p className="eyebrow" style={{ textAlign: "center" }}>
            合作過的學校與機構
          </p>
          <div className="marquee" aria-label="合作單位">
            <div className="marquee-track">
              {[...partners, ...partners].map((p, i) => (
                <span key={`${p}-${i}`} className="partner" aria-hidden={i >= partners.length ? true : undefined}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 11. 雙軌行動呼籲 */}
      <section>
        <div className="container grid cols-2">
          <div className="cta-card cta-parent">
            <p className="eyebrow">給家長</p>
            <h2>帶孩子來玩一次</h2>
            <p>告訴我們孩子的年級與興趣，我們推薦合適的試聽課程與時段。</p>
            <div className="btn-row">
              <Link href="/contact?type=trial" className="btn primary">
                預約試聽
              </Link>
            </div>
          </div>
          <div className="cta-card cta-school">
            <p className="eyebrow">給學校與機構</p>
            <h2>把動手做的課帶進校園</h2>
            <p>入校課程、社團營隊、親子館活動與客製化專案，提供教案、教材與師資。</p>
            <div className="btn-row">
              <Link href="/contact?type=school" className="btn">
                洽詢合作
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

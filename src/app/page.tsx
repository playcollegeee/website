import Image from "next/image";
import Link from "next/link";
import AvatarPreview from "@/components/AvatarPreview";
import CourseQuiz from "@/components/CourseQuiz";
import { featured, gallery, highlights, interestQuests, levels, site, stats, valueProps } from "@/lib/content";

const ribbonWords = ["先探索", "再發現", "逐步深入", "LEGO 機器人", "3D 造物", "美術創作", "動手做", "玩出興趣"];

function Ribbon({ tone }: { tone: "yellow" | "blue" }) {
  return (
    <div className="ribbon-wrap" aria-hidden="true">
      <div className={`ribbon ribbon-${tone}`}>
        <div className="ribbon-track">
          {[...ribbonWords, ...ribbonWords].map((w, i) => (
            <span key={i}>★ {w}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

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

      <Ribbon tone="yellow" />

      {/* 任務入口：從孩子的興趣出發 */}
      <section>
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">選擇你的任務</p>
            <h2>孩子喜歡什麼？從這裡出發</h2>
            <p className="lead">不用先搞懂課程名稱，從孩子平常最愛做的事開始找。</p>
          </div>
          <div className="quests">
            {interestQuests.map((q) => (
              <Link key={q.title} href={q.href} className={`quest q-${q.color}`}>
                <span className="quest-emoji" aria-hidden="true">
                  {q.emoji}
                </span>
                <strong>{q.title}</strong>
                <span>{q.text}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 找課小測驗 */}
      <section className="bg-blue" id="quiz">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">30 秒找課</p>
            <h2>回答兩題，找到最適合的班級</h2>
          </div>
          <CourseQuiz />
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
            <Image src={featured.image} alt={`${featured.name}上課情形`} width={1100} height={825} sizes="(max-width: 860px) 100vw, 540px" />
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
              <article key={h.title} className={`card photo-card bar-${h.color}`}>
                <div className="photo">
                  <Image src={h.image} alt={h.title} width={825} height={1100} sizes="(max-width: 860px) 100vw, 360px" />
                </div>
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
            <p className="eyebrow">教室現場</p>
            <h2>每一個作品，都是孩子自己動手完成的</h2>
          </div>
          <div className="photo-wall">
            {gallery.map((g) => (
              <figure key={g.src} className="photo-item">
                <Image src={g.src} alt={g.alt} width={g.w} height={g.h} sizes="(max-width: 860px) 50vw, 380px" />
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

      <Ribbon tone="blue" />

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

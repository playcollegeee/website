import Image from "next/image";
import Link from "next/link";
import AvatarCreator from "@/components/AvatarCreator";
import BrickPlayground from "@/components/BrickPlayground";
import CourseQuiz from "@/components/CourseQuiz";
import StackingLevels from "@/components/StackingLevels";
import { featured, heroPhoto, interestQuests, site, stats, valueProps } from "@/lib/content";
import { getPublishedPhotos } from "@/lib/sitePhotos";
import PhotoMarquee, { fillTo } from "@/components/PhotoMarquee";

// 教室現場照片在這個數量以內用兩排固定排列，超過就改成兩排跑馬燈
const GALLERY_STATIC_MAX = 6;

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

export default async function HomePage() {
  const [highlightPhotos, galleryPhotos] = await Promise.all([getPublishedPhotos("highlights"), getPublishedPhotos("gallery")]);
  return (
    <>
      {/* 1. 首屏 */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">台中・兒童 STEAM 探索學院</p>
            <h1>
              透過<span>玩</span>，發現超能力，
              <br />
              遇見閃閃發亮的自己
            </h1>
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
          <div className="hero-side">
            {/* 手機：先看到孩子上課的照片，積木遊樂區排在後面 */}
            <figure className="hero-photo">
              <Image src={heroPhoto.src} alt={heroPhoto.alt} width={heroPhoto.w} height={heroPhoto.h} sizes="(max-width: 860px) 100vw, 1px" priority />
              <figcaption>{heroPhoto.alt}</figcaption>
            </figure>
            <BrickPlayground />
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
            <p className="slogan">{site.tagline}</p>
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
          <StackingLevels />
        </div>
      </section>

      {/* 7. 成果與活動紀錄（照片與文字在後台「官網照片」管理） */}
      {highlightPhotos.length > 0 && (
        <section>
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">成果與活動紀錄</p>
              <h2>孩子們最近做了什麼</h2>
            </div>
          </div>
          {/* 單排跑馬燈：每張卡片約 8 秒移過一格，越多張一輪越久，速度不變 */}
          <PhotoMarquee label="成果與活動紀錄" seconds={fillTo(highlightPhotos, 6).length * 8}>
            {fillTo(highlightPhotos, 6).map((h, i) => (
              // 為了補滿畫面而重複的卡片，讀屏軟體略過，只念一次
              <article key={`${h.id}-${i}`} className={`card photo-card bar-${h.color}`} aria-hidden={i >= highlightPhotos.length ? true : undefined}>
                <div className="photo">
                  <Image src={h.image_url} alt={h.title} width={h.width} height={h.height} sizes="300px" />
                </div>
                {h.tag && <span className="tag">{h.tag}</span>}
                <h3>{h.title}</h3>
                {h.body && <p>{h.body}</p>}
              </article>
            ))}
          </PhotoMarquee>
        </section>
      )}

      {/* 8. 作品牆（照片與說明在後台「官網照片」管理） */}
      {galleryPhotos.length > 0 && (
        <section className="bg-yellow">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">教室現場</p>
              <h2>每一個作品，都是孩子自己動手完成的</h2>
            </div>
            {galleryPhotos.length <= GALLERY_STATIC_MAX && (
              <div className="photo-wall">
                {galleryPhotos.map((g) => (
                  <figure key={g.id} className="photo-item">
                    <Image src={g.image_url} alt={g.title} width={g.width} height={g.height} sizes="(max-width: 860px) 50vw, 380px" />
                    <figcaption>{g.title}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
          {/* 超過 6 張改成上下兩排跑馬燈，上排往左、下排往右 */}
          {galleryPhotos.length > GALLERY_STATIC_MAX &&
            [0, 1].map((row) => {
              const rowPhotos = galleryPhotos.filter((_, i) => i % 2 === row);
              const items = fillTo(rowPhotos, 6);
              return (
                <PhotoMarquee key={row} label={`教室現場第 ${row + 1} 排`} seconds={items.length * 7} reverse={row === 1}>
                  {items.map((g, i) => (
                    <figure key={`${g.id}-${i}`} className="photo-item" aria-hidden={i >= rowPhotos.length ? true : undefined}>
                      <Image src={g.image_url} alt={g.title} width={g.width} height={g.height} sizes="280px" />
                      <figcaption>{g.title}</figcaption>
                    </figure>
                  ))}
                </PhotoMarquee>
              );
            })}
        </section>
      )}

      {/* 9. 角色試玩 */}
      <section className="bg-blue" id="avatar">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">角色試玩・玩學院角色養成</p>
            <h2>選一條職業路線，完成一期就能轉職</h2>
            <p className="lead">
              每位學生都有一個專屬的像素角色。每堂課刷卡累積經驗值，完成一期解鎖新裝備；完成第 1 期還能從 6 種職業裡挑一種轉職。先來試玩看看！
            </p>
          </div>
          <AvatarCreator />
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

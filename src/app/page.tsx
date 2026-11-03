import Image from "next/image";
import Link from "next/link";
import AvatarPreview from "@/components/AvatarPreview";
import { levels, majors, programs, site } from "@/lib/content";

export default function HomePage() {
  return (
    <>
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
            <Image className="a" src="/images/croc.webp" alt="" width={640} height={480} priority />
            <Image className="b" src="/images/walker.webp" alt="" width={640} height={480} priority />
          </div>
        </div>
      </section>

      <section className="bg-yellow">
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

      <section>
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

      <section>
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">活動與工作坊</p>
            <h2>還沒決定主修？先來玩一次</h2>
          </div>
          <div className="grid cols-2">
            {programs.slice(0, 2).map((p) => (
              <div key={p.name} className="card">
                {p.image && (
                  <div className="card-img">
                    <Image src={p.image} alt={`${p.name}作品範例`} width={640} height={480} />
                  </div>
                )}
                <h3>{p.name}</h3>
                <p>{p.summary}</p>
                {p.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div className="btn-row">
            <Link href="/workshops" className="btn">
              看所有活動
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

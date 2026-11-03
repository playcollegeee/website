import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { levels, majors } from "@/lib/content";

export const metadata: Metadata = {
  title: "課程介紹",
  description: "玩學院五階段分班與三大主修：LEGO 樂高建構與機器人、3D 列印與造物、美術與視覺創作，以及探索選修。",
};

export default function CoursesPage() {
  return (
    <>
      <section>
        <div className="container">
          <p className="eyebrow">課程介紹</p>
          <h1>先探索，再找到想深入的領域</h1>
          <p className="lead">
            玩學院以年級分成五個階段，每個階段有三大主修可以選。主修一期一選，期末可以續讀或更換；還不確定的孩子，可以先從探索選修開始。
          </p>
        </div>
      </section>

      <section className="bg-yellow">
        <div className="container">
          <div className="section-head">
            <h2>五階段分班</h2>
            <p className="lead">年級是主要依據，實際難度會依孩子的先備能力調整。</p>
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

      {majors.map((m, i) => (
        <section key={m.slug} id={m.slug} className={i % 2 === 1 ? "bg-green" : undefined}>
          <div className="container grid cols-2" style={{ alignItems: "start" }}>
            <div>
              <p className="eyebrow">主修 {i + 1}・{m.from}</p>
              <h2>{m.name}</h2>
              <p className="lead">{m.intro}</p>
              {m.image && <Image src={m.image} alt={`${m.short}作品範例`} width={640} height={478} style={{ maxWidth: 420, marginTop: 16 }} />}
            </div>
            <div className={`card bar-${m.color}`}>
              <h3>會學到什麼</h3>
              <ul>
                {m.topics.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <h3 style={{ marginTop: 20 }}>各階段的學習路徑</h3>
              <table className="path">
                <tbody>
                  {m.path.map((p) => (
                    <tr key={p.level}>
                      <td>{p.level}</td>
                      <td>{p.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}

      <section className="bg-blue">
        <div className="container">
          <h2>探索選修</h2>
          <p className="lead">
            麥塊程式、Arduino 互動科技、科學實驗、節慶主題、外師工作坊……用點數報名單堂體驗，不必先買一整期，找到興趣再決定主修。
          </p>
          <p className="hint">開課主題與點數依每月公告為準。</p>
          <div className="btn-row">
            <Link href="/workshops" className="btn">
              看近期活動
            </Link>
            <Link href="/contact" className="btn primary">
              預約試聽
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

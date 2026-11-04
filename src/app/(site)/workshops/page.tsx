import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { programs } from "@/lib/content";

export const metadata: Metadata = {
  title: "活動與工作坊",
  description: "積木故事屋、樂高動滋動、3D 造物體驗工作坊與寒暑假營隊。",
};

export default function WorkshopsPage() {
  return (
    <>
      <section>
        <div className="container">
          <p className="eyebrow">活動與工作坊</p>
          <h1>從一次體驗開始</h1>
          <p className="lead">每月都有新主題。孩子在一次活動裡，從想法、設計到完成作品，帶著成就感回家。</p>
        </div>
      </section>
      <section className="bg-yellow">
        <div className="container grid cols-2">
          {programs.map((p) => (
            <div key={p.name} className="card">
              {p.image && (
                <div className="card-img">
                  <Image src={p.image} alt={`${p.name}作品範例`} width={640} height={480} />
                </div>
              )}
              <h3>{p.name}</h3>
              <p>
                <strong>適合對象：</strong>
                {p.audience}
              </p>
              <p>{p.summary}</p>
              {p.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="container">
          <h2>想知道下一場在什麼時候？</h2>
          <p className="lead">留下聯絡方式，新活動公布時我們會第一時間通知你。</p>
          <div className="btn-row">
            <Link href="/contact" className="btn primary">
              留下聯絡方式
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

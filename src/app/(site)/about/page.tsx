import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/content";

export const metadata: Metadata = {
  title: "關於玩學院",
  description: "帶著孩子在玩樂當中，發現屬於自己的超能力，遇見那個閃閃發亮的自己。",
};

const values = [
  { title: "自由探索", text: "接觸不同領域，不急著決定，先找到心動的那一個。", color: "yellow" },
  { title: "動手實作", text: "透過嘗試、失敗、修正與創作，真正理解科學、工程、藝術與科技。", color: "green" },
  { title: "逐步深入", text: "找到興趣後，同一個領域有清楚的進階路徑，可以一直往上走。", color: "red" },
  { title: "看得見的成長", text: "作品、專題與學習紀錄，讓家長清楚看到孩子的進步。", color: "blue" },
];

export default function AboutPage() {
  return (
    <>
      <section>
        <div className="container">
          <p className="eyebrow">關於玩學院</p>
          <h1>教育不只有考試和成績</h1>
          <p className="slogan">{site.tagline}</p>
          <p className="lead">
            玩學院希望讓孩子有機會接觸不同領域，在實作、嘗試、失敗與修正之間，慢慢找到自己真正喜歡的事物，並且累積作品與學習歷程。
          </p>
        </div>
      </section>
      <section className="bg-yellow">
        <div className="container grid cols-2">
          {values.map((v) => (
            <div key={v.title} className={`card bar-${v.color}`}>
              <h3>{v.title}</h3>
              <p>{v.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="container grid cols-2" style={{ alignItems: "center" }}>
          <div>
            <p className="eyebrow">創辦人</p>
            <h2>阿智老師</h2>
            <p className="lead">
              樂高機器人教師，多年帶著孩子從積木走到機器人與 3D 造物。相信簡單的陪伴就能帶來改變，也相信每個孩子都能在「玩」裡找到自己的優勢。
            </p>
          </div>
          <div className="card bar-blue">
            <h3>想更認識我們？</h3>
            <p>歡迎帶孩子來試聽一堂課，親自看看孩子在玩學院的樣子。</p>
            <div className="btn-row">
              <Link href="/contact" className="btn primary">
                預約試聽
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

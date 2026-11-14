import Link from "next/link";
import { interestQuests } from "@/lib/content";

// 首頁可開關的區塊（後台「官網區塊開關」控制，關閉時在後台可預覽）

const ribbonWords = ["先探索", "再發現", "逐步深入", "LEGO 機器人", "3D 造物", "美術創作", "動手做", "玩出興趣"];

export function Ribbon({ tone }: { tone: "yellow" | "blue" }) {
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

// 任務入口：從孩子的興趣出發
export function Quests() {
  return (
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
              <span className="quest-emoji" aria-hidden="true">{q.emoji}</span>
              <strong>{q.title}</strong>
              <span>{q.text}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

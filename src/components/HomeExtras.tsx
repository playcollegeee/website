import Link from "next/link";
import { interestQuests } from "@/lib/content";

// 首頁可開關的區塊（後台「官網區塊開關」控制，關閉時在後台可預覽）

// 標語跑馬燈（2026-11-15 使用者選 C「LOGO 零件跳跳帶」）：文字中間夾著原始 LOGO 切出的零件，輕輕上下跳
const ribbonWords = ["先探索", "再發現", "逐步深入", "玩出興趣", "LEGO 機器人", "3D 造物", "美術創作", "動手做"];
const ribbonParts = ["roof", "p1", "p2", "box", "cap", "base"];

export function Ribbon({ tone }: { tone: "yellow" | "blue" }) {
  // 一份內容；畫面上放兩份接起來循環（第二份讀屏軟體略過）
  const one = ribbonWords.map((w, i) => (
    <span key={i} className="lp-item">
      <span className="lp-word">{w}</span>
      <img src={`/brand/parts/${ribbonParts[i % ribbonParts.length]}.png`} alt="" className={`lp-part lp-${ribbonParts[i % ribbonParts.length]}`} style={{ animationDelay: `${-i * 0.37}s` }} />
    </span>
  ));
  return (
    <div className={`lp-band${tone === "blue" ? " lp-rev" : ""}`} aria-hidden="true">
      <div className="lp-track">
        <div className="lp-copy">{one}</div>
        <div className="lp-copy">{one}</div>
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

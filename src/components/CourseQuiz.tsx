"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { burstConfetti } from "@/lib/confetti";
import { levels, majors, quiz } from "@/lib/content";

// 兩題小測驗：年級 + 喜歡做什麼 → 推薦班級與主修，直接帶到試聽表單
export default function CourseQuiz() {
  const [level, setLevel] = useState<string | null>(null);
  const [major, setMajor] = useState<string | null>(null);

  const lv = levels.find((l) => l.slug === level);
  // 3D 主修從國小三年級（玩樂班）開放
  const tooYoungFor3d = major === "3d" && (level === "wanbao" || level === "wantong");
  const mj = majors.find((m) => m.slug === (tooYoungFor3d ? "lego" : major));
  const done = level !== null && major !== null;
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!done || !resultRef.current) return;
    const r = resultRef.current.getBoundingClientRect();
    burstConfetti(r.left + r.width / 2, r.top + 40, 70);
  }, [done, level, major]);

  const params = new URLSearchParams({ type: "trial" });
  if (level) params.set("level", level);
  if (mj) params.set("major", mj.slug);

  return (
    <div className="quiz">
      <div className="quiz-step">
        <p className="quiz-q">
          <span className="quiz-n">1</span>孩子現在幾年級？
        </p>
        <div className="quiz-options">
          {quiz.grades.map((g) => (
            <button
              key={g.level}
              type="button"
              className={`chip${level === g.level ? " on" : ""}`}
              aria-pressed={level === g.level}
              onClick={() => setLevel(g.level)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="quiz-step" style={{ opacity: level ? 1 : 0.45 }}>
        <p className="quiz-q">
          <span className="quiz-n">2</span>孩子最喜歡做什麼？
        </p>
        <div className="quiz-options">
          {quiz.likes.map((o) => (
            <button
              key={o.label}
              type="button"
              className={`chip${major === o.major ? " on" : ""}`}
              aria-pressed={major === o.major}
              disabled={!level}
              onClick={() => setMajor(o.major)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={resultRef} className={`quiz-result${done ? " pop-in" : ""}`} key={done ? `${level}-${major}` : "empty"} aria-live="polite">
        {done && lv ? (
          <>
            <p className="eyebrow">推薦給你的孩子</p>
            <h3>
              {lv.name}
              {mj ? `・${mj.short}` : "・探索選修"}
            </h3>
            <p>
              {mj
                ? mj.path.find((p) => lv.name.startsWith(p.level))?.text ?? mj.intro
                : "先用探索選修體驗 LEGO、3D 造物與美術，找到最有興趣的再選主修。"}
            </p>
            {tooYoungFor3d && <p className="hint">3D 列印主修從國小三年級開始，現階段先從 LEGO 打好建構基礎。</p>}
            <div className="btn-row">
              <Link href={`/contact?${params.toString()}`} className="btn primary">
                預約這堂試聽
              </Link>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setLevel(null);
                  setMajor(null);
                }}
              >
                重新選
              </button>
            </div>
          </>
        ) : (
          <p className="hint">回答兩個問題，馬上告訴你適合的班級與主修。</p>
        )}
      </div>
    </div>
  );
}

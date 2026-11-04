"use client";

import { useEffect, useRef } from "react";
import { levels } from "@/lib/content";

// 五階段分班：往下捲動時，五塊「積木卡片」一塊塊從上方掉下來，疊成往上走的階梯。
// 動畫進度跟著捲動位置走（往回捲會倒帶）；開啟「減少動態效果」的人直接看到完成的樣子。

const easeOutBack = (t: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const tilt = [-9, 7, -6, 8, -5];

export default function StackingLevels() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>(".stack-brick"));
    const path = root.querySelector<HTMLElement>(".stack-path-fill");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cards.forEach((c) => c.style.setProperty("--p", "1"));
      if (path) path.style.transform = "scaleX(1)";
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      const r = root.getBoundingClientRect();
      const vh = window.innerHeight;
      // 區塊頂端進到畫面 85% 時開始，到畫面 30% 時全部疊好
      const progress = Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (vh * 0.55 + r.height * 0.35)));
      cards.forEach((c, i) => {
        const local = Math.max(0, Math.min(1, (progress - i * 0.13) / 0.36));
        const e = easeOutBack(local);
        c.style.setProperty("--p", local.toFixed(3));
        c.style.transform = `translateY(${((1 - e) * -180).toFixed(1)}px) rotate(${((1 - local) * tilt[i % tilt.length]).toFixed(2)}deg)`;
      });
      if (path) path.style.transform = `scaleX(${Math.max(0, Math.min(1, (progress - 0.1) / 0.8)).toFixed(3)})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div ref={ref} className="stack">
      <div className="stack-path" aria-hidden="true">
        <div className="stack-path-fill" />
      </div>
      <ol className="stack-row">
        {levels.map((l, i) => (
          <li key={l.slug} className={`stack-brick b-${l.color}`}>
            <span className="studs" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="step">STEP {i + 1}</span>
            <h3>{l.name}</h3>
            <span className="grades">{l.grades}</span>
            <p>{l.focus}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

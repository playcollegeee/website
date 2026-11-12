"use client";

// 水面投票按鈕：按下去時，從愛心往外擴散品牌四色的水波
// 設計參考 @Lattice_Node 的「水面のいいね」（ludion.ai/p/like-pond，MIT），程式為玩學院自行撰寫的輕量版（Canvas 2D，沒有 WebGL）
import { useEffect, useRef, useState } from "react";

const COLORS = ["#FBC20F", "#5CBEAA", "#EA5754", "#5098D2"];

type Ring = { born: number; color: string; max: number; width: number };
type Drop = { born: number; x: number; y: number; vx: number; vy: number; color: string };

export default function PondVote({
  count,
  on,
  disabled,
  title,
  onToggle,
}: {
  count: number;
  on: boolean;
  disabled?: boolean;
  title?: string;
  onToggle: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rings = useRef<Ring[]>([]);
  const drops = useRef<Drop[]>([]);
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // 按下就先變色、數字先加減（不用等伺服器），伺服器回來後以正式結果為準
  const [opt, setOpt] = useState<boolean | null>(null);
  useEffect(() => setOpt(null), [on, count]);
  const shownOn = opt ?? on;
  const shownCount = count + (opt === null ? 0 : (opt ? 1 : 0) - (on ? 1 : 0));

  function splash(voting: boolean) {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const now = performance.now();
    if (voting) {
      // 投票：三圈彩色水波＋幾顆水珠
      COLORS.slice(0, 3).forEach((c, i) => rings.current.push({ born: now + i * 110, color: c, max: 46 + i * 8, width: 2.5 - i * 0.5 }));
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.42;
        const sp = 0.09 + Math.random() * 0.05;
        drops.current.push({ born: now, x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color: COLORS[i % 4] });
      }
    } else {
      // 收回：一圈淡淡的水波
      rings.current.push({ born: now, color: "#b9b2a3", max: 26, width: 1.5 });
    }
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(draw);
  }

  function draw(t: number) {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = 80, cy = 57; // 愛心在畫布裡的位置（畫布比按鈕大一圈，見 .pond-canvas）

    rings.current = rings.current.filter((r) => t - r.born < 900);
    for (const r of rings.current) {
      const p = (t - r.born) / 900;
      if (p < 0) continue;
      const e = 1 - Math.pow(1 - p, 3);
      ctx.globalAlpha = (1 - p) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 6 + e * r.max, (6 + e * r.max) * 0.62, 0, 0, Math.PI * 2); // 壓扁一點，像從斜上方看水面
      ctx.stroke();
    }
    drops.current = drops.current.filter((d) => t - d.born < 650);
    for (const d of drops.current) {
      const dt = t - d.born;
      const p = dt / 650;
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(cx + d.vx * dt, cy + d.vy * dt + 0.00012 * dt * dt, 2.2 * (1 - p * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (rings.current.length || drops.current.length) raf.current = requestAnimationFrame(draw);
  }

  return (
    <span className="pond-vote">
      <canvas ref={canvasRef} className="pond-canvas" aria-hidden="true" />
      <button
        type="button"
        className={`pond-btn${shownOn ? " on" : ""}`}
        aria-pressed={shownOn}
        aria-label={`${shownOn ? "收回這一票" : "投一票"}，目前 ${shownCount} 票`}
        title={title}
        disabled={disabled}
        onClick={() => {
          splash(!shownOn);
          setOpt(!shownOn);
          onToggle();
        }}
      >
        <svg viewBox="0 0 120 110" aria-hidden="true" className="pond-heart">
          <path d="M60 104C24 76 8 58 8 35 8 18 21 6 37 6c10 0 18 5 23 14C65 11 73 6 83 6c16 0 29 12 29 29 0 23-16 41-52 69Z" />
        </svg>
        <span className="pond-num" key={shownCount}>{shownCount}</span>
      </button>
    </span>
  );
}

"use client";

// 登入頁背景：品牌四色的積木像相機光圈一樣旋轉打開，中間露出登入卡片
// 設計參考 @Lattice_Node 的「Lumen Gate」（ludion.ai/p/login-lumen，MIT）的光圈開門概念，程式為玩學院自行撰寫（Canvas 2D）
import { useEffect, useRef } from "react";

const COLORS = ["#FBC20F", "#5CBEAA", "#EA5754", "#5098D2"];
const BLADES = 16;

// 顏色加亮／變暗（做積木的上面與側面）
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export default function BrickGate() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let busy = 0; // 送出登入時，光圈稍微收起來、轉快一點
    let busyTarget = 0;
    let raf = 0;
    const onBusy = (e: Event) => {
      busyTarget = (e as CustomEvent<boolean>).detail ? 1 : 0;
      if (still) draw(performance.now());
    };
    window.addEventListener("pc-gate", onBusy);

    function brick(x: number, y: number, len: number, w: number, color: string) {
      // 一塊從側面看的長條積木：本體＋上方凸點
      const r = Math.min(8, w * 0.22);
      ctx!.fillStyle = shade(color, -0.18);
      ctx!.beginPath();
      ctx!.roundRect(x, y + 4, len, w, r);
      ctx!.fill();
      ctx!.fillStyle = color;
      ctx!.beginPath();
      ctx!.roundRect(x, y, len, w, r);
      ctx!.fill();
      ctx!.fillStyle = shade(color, 0.28);
      ctx!.fillRect(x + r, y + 3, len - r * 2, Math.max(2, w * 0.1));
      const studs = Math.max(2, Math.floor(len / (w * 0.9)));
      const gap = len / studs;
      for (let i = 0; i < studs; i++) {
        const sx = x + gap * (i + 0.5);
        ctx!.fillStyle = shade(color, -0.12);
        ctx!.beginPath();
        ctx!.ellipse(sx, y - w * 0.12 + 2, w * 0.22, w * 0.12, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = shade(color, 0.18);
        ctx!.beginPath();
        ctx!.ellipse(sx, y - w * 0.12, w * 0.22, w * 0.12, 0, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function draw(t: number) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = cv!.clientWidth, H = cv!.clientHeight;
      if (cv!.width !== Math.round(W * dpr) || cv!.height !== Math.round(H * dpr)) {
        cv!.width = Math.round(W * dpr);
        cv!.height = Math.round(H * dpr);
      }
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, W, H);

      busy += (busyTarget - busy) * 0.08;
      const sec = (t - start) / 1000;
      const p = still ? 1 : Math.min(1, sec / 1.8);
      const open = 1 - Math.pow(1 - p, 3); // 先快後慢地打開
      const cx = W / 2, cy = H / 2;
      const S = Math.min(W, H);
      const hole = S * (0.05 + 0.33 * open) * (1 - busy * 0.25); // 中間的洞
      const len = Math.max(W, H) * 0.62;
      const w = Math.max(26, S * 0.07);
      const spin = still ? 0 : (1 - open) * 1.2 + sec * (0.03 + busy * 0.6);

      // 中間的暖光
      const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, hole * 1.6);
      g.addColorStop(0, "rgba(255,249,224,1)");
      g.addColorStop(1, "rgba(255,249,224,0)");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, W, H);

      for (let i = 0; i < BLADES; i++) {
        const a = (i / BLADES) * Math.PI * 2 + spin;
        ctx!.save();
        ctx!.translate(cx, cy);
        ctx!.rotate(a);
        // 光圈的葉片：每塊往外移，再斜一個角度，彼此疊起來
        ctx!.translate(hole, 0);
        ctx!.rotate(-0.62 + (1 - open) * 0.4);
        ctx!.globalAlpha = 0.92;
        brick(0, -w / 2, len, w, COLORS[i % 4]);
        ctx!.restore();
      }
      ctx!.globalAlpha = 1;
      if (!still) raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    const onResize = () => still && draw(performance.now());
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pc-gate", onBusy);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="gate-canvas" aria-hidden="true" />;
}

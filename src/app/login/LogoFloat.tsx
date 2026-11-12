"use client";

// 登入頁背景：和 10 秒形象影片同樣的暖白底＋淡色小方塊，再加上 LOGO 圖示拆開的零件（屋頂、柱子、方塊、底座）慢慢飄
// 零件圖檔 public/brand/parts/*.png 是從原始 LOGO（D:\玩學院\LOGO-05.png）切出來的，形狀與顏色沒有更動
import { useEffect, useRef } from "react";

const Y = "#FBC20F", G = "#5CBEAA", R = "#EA5754", B = "#5098D2";
type Kind = "chip" | "roof" | "p1" | "p2" | "box" | "cap" | "base";
const PARTS: Kind[] = ["roof", "p1", "p2", "cap", "box", "base"];
// 零件的原始比例（寬／高，取自 LOGO-05.png）
const RATIO: Record<string, number> = { roof: 337 / 145, p1: 70 / 149, p2: 70 / 149, cap: 80 / 38, box: 118 / 99, base: 337 / 56 };
type Item = { kind: Kind; color: string; x: number; y: number; s: number; a: number; vx: number; vy: number; va: number; alpha: number; phase: number };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function make(W: number, H: number): Item[] {
  const items: Item[] = [];
  const area = (W * H) / (1280 * 800);
  // 影片裡的淡色圓角小方塊
  const chips = Math.round(26 * Math.max(0.5, area));
  for (let i = 0; i < chips; i++) {
    items.push({ kind: "chip", color: [Y, G, R, B][i % 4], x: rnd(0, W), y: rnd(0, H), s: rnd(14, 38), a: rnd(-0.4, 0.4),
      vx: rnd(-6, 6), vy: rnd(-5, 5), va: rnd(-0.05, 0.05), alpha: rnd(0.16, 0.3), phase: rnd(0, 6) });
  }
  // LOGO 零件：顏色和形狀照 LOGO
  const parts: [Kind, string][] = [["roof", Y], ["p1", B], ["p2", G], ["cap", R], ["box", R], ["base", Y], ["roof", Y], ["p1", B], ["p2", G], ["box", R]];
  const n = Math.round(parts.length * Math.max(0.6, Math.min(1, area)));
  for (let i = 0; i < n; i++) {
    const [kind, color] = parts[i];
    items.push({ kind, color, x: rnd(0, W), y: rnd(0, H), s: rnd(46, 92), a: rnd(-0.6, 0.6),
      vx: rnd(-10, 10), vy: rnd(-8, 8), va: rnd(-0.12, 0.12), alpha: rnd(0.55, 0.8), phase: rnd(0, 6) });
  }
  return items;
}

function drawItem(ctx: CanvasRenderingContext2D, it: Item, bob: number, imgs: Record<string, HTMLImageElement>) {
  const s = it.s;
  ctx.save();
  ctx.translate(it.x, it.y + bob);
  ctx.rotate(it.a);
  ctx.globalAlpha = it.alpha;
  if (it.kind === "chip") {
    ctx.fillStyle = it.color;
    ctx.beginPath();
    ctx.roundRect(-s / 2, -s * 0.38, s, s * 0.76, s * 0.22);
    ctx.fill();
  } else {
    const img = imgs[it.kind];
    if (img?.complete && img.naturalWidth) {
      // 以零件較長的一邊當大小，維持原始比例
      const r = RATIO[it.kind];
      const w = r >= 1 ? s * 1.3 : s * r, h = r >= 1 ? (s * 1.3) / r : s;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    }
  }
  ctx.restore();
}

export default function LogoFloat() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let items: Item[] = [];
    let raf = 0;
    let last = performance.now();
    const imgs: Record<string, HTMLImageElement> = {};
    for (const k of PARTS) {
      const im = new Image();
      im.src = `/brand/parts/${k}.png`;
      if (still) im.onload = () => frame(performance.now());
      imgs[k] = im;
    }

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = cv!.clientWidth, H = cv!.clientHeight;
      cv!.width = Math.round(W * dpr);
      cv!.height = Math.round(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      items = make(W, H);
    }

    function frame(t: number) {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const W = cv!.clientWidth, H = cv!.clientHeight;
      ctx!.clearRect(0, 0, W, H);
      for (const it of items) {
        if (!still) {
          it.x += it.vx * dt;
          it.y += it.vy * dt;
          it.a += it.va * dt;
          const m = it.s;
          // 飄出畫面就從另一邊回來
          if (it.x < -m) it.x = W + m; else if (it.x > W + m) it.x = -m;
          if (it.y < -m) it.y = H + m; else if (it.y > H + m) it.y = -m;
        }
        drawItem(ctx!, it, still ? 0 : Math.sin(t / 1400 + it.phase) * 4, imgs);
      }
      if (!still) raf = requestAnimationFrame(frame);
    }

    size();
    raf = requestAnimationFrame(frame);
    const onResize = () => {
      size();
      if (still) frame(performance.now());
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="gate-canvas" aria-hidden="true" />;
}

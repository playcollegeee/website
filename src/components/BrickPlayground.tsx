"use client";

import { useEffect, useRef } from "react";
import { burstConfetti } from "@/lib/confetti";

// 首頁的「積木雨」：積木會掉下來、像真的樂高一樣卡在凸點格線上，可以拖曳重新堆疊。
// 不依賴外部套件：自己寫的簡單重力＋碰撞（只處理水平對齊的長方形，剛好符合積木堆疊）。

const STUD = 18; // 一個凸點的寬度（px）
const BRICK_H = 26;
const COLORS = ["#fbc20f", "#5cbeaa", "#ea5754", "#5098d2"];
const LETTERS = ["玩", "學", "院"];
const MAX_BRICKS = 42;

type Brick = {
  x: number; // 左上角
  y: number;
  w: number; // 寬度（凸點數）
  vy: number;
  color: string;
  label?: string;
  dragging?: boolean;
};

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

export default function BrickPlayground() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<{ rain: () => void; clear: () => void } | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0;
    let H = 0;
    let cols = 0;
    let ox = 0; // 讓凸點格線置中
    let bricks: Brick[] = [];
    let raf = 0;
    let visible = true;
    let drag: { b: Brick; dx: number; dy: number } | null = null;
    let lastLetter = 0;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      cols = Math.floor((W - 12) / STUD);
      ox = (W - cols * STUD) / 2;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bricks.forEach((b) => (b.x = snapX(b.x, b.w)));
    };

    const snapX = (px: number, w: number) => ox + Math.max(0, Math.min(cols - w, Math.round((px - ox) / STUD))) * STUD;

    const addBrick = (px: number, py: number) => {
      if (bricks.length >= MAX_BRICKS) bricks.shift();
      const w = [2, 3, 4][Math.floor(Math.random() * 3)];
      const label = lastLetter < LETTERS.length && Math.random() < 0.35 ? LETTERS[lastLetter++] : undefined;
      bricks.push({ x: snapX(px - (w * STUD) / 2, w), y: py, w, vy: 0, color: COLORS[Math.floor(Math.random() * COLORS.length)], label });
    };

    // 找出這塊積木正下方能停住的高度（地板或其他積木的頂部）
    const landingY = (b: Brick) => {
      let floor = H;
      for (const o of bricks) {
        if (o === b || o.dragging) continue;
        const overlap = b.x < o.x + o.w * STUD && o.x < b.x + b.w * STUD;
        if (overlap && o.y >= b.y + BRICK_H - 1 && o.y < floor) floor = o.y;
      }
      return floor - BRICK_H;
    };

    const step = () => {
      // 由下往上處理，下面的積木先落定
      const order = [...bricks].sort((a, b) => b.y - a.y);
      for (const b of order) {
        if (b.dragging) continue;
        const land = landingY(b);
        b.vy = Math.min(b.vy + 0.9, 24);
        b.y += b.vy;
        if (b.y >= land) {
          b.y = land;
          b.vy = Math.abs(b.vy) > 4 ? -b.vy * 0.22 : 0;
        }
      }
    };

    const drawBrick = (b: Brick) => {
      const w = b.w * STUD;
      const top = shade(b.color, 28);
      const side = shade(b.color, -38);
      // 凸點
      for (let i = 0; i < b.w; i++) {
        const sx = b.x + i * STUD + 4;
        ctx.fillStyle = side;
        ctx.beginPath();
        ctx.roundRect(sx, b.y - 6, STUD - 8, 8, 2);
        ctx.fill();
        ctx.fillStyle = top;
        ctx.beginPath();
        ctx.roundRect(sx, b.y - 7, STUD - 8, 5, 2);
        ctx.fill();
      }
      // 本體
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(b.x + 0.5, b.y, w - 1, BRICK_H, 4);
      ctx.fill();
      ctx.fillStyle = side;
      ctx.fillRect(b.x + 0.5, b.y + BRICK_H - 5, w - 1, 5);
      if (b.label) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 15px 'PingFang TC','Noto Sans TC','Microsoft JhengHei',sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(b.label, b.x + w / 2, b.y + BRICK_H / 2 - 2);
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      // 底板
      ctx.fillStyle = "#e3f4f0";
      ctx.fillRect(0, H - 6, W, 6);
      [...bricks].sort((a, b) => a.y - b.y).forEach(drawBrick);
    };

    const loop = () => {
      if (visible) {
        step();
        draw();
      }
      raf = requestAnimationFrame(loop);
    };

    const rain = (n: number, stagger: number) => {
      for (let i = 0; i < n; i++) {
        const fire = () => addBrick(STUD + Math.random() * (W - STUD * 2), -BRICK_H - Math.random() * 120);
        if (stagger) window.setTimeout(fire, i * stagger);
        else fire();
      }
    };

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    let downAt: { x: number; y: number } | null = null;

    const onDown = (e: PointerEvent) => {
      const p = pos(e);
      downAt = p;
      const hit = [...bricks].reverse().find((b) => p.x >= b.x && p.x <= b.x + b.w * STUD && p.y >= b.y - 7 && p.y <= b.y + BRICK_H);
      if (hit) {
        hit.dragging = true;
        hit.vy = 0;
        drag = { b: hit, dx: p.x - hit.x, dy: p.y - hit.y };
        canvas.setPointerCapture(e.pointerId);
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = pos(e);
      if (drag) {
        drag.b.x = Math.max(0, Math.min(W - drag.b.w * STUD, p.x - drag.dx));
        drag.b.y = Math.max(0, Math.min(H - BRICK_H, p.y - drag.dy));
        if (reduceMotion) draw();
      }
      const over = bricks.some((b) => p.x >= b.x && p.x <= b.x + b.w * STUD && p.y >= b.y - 7 && p.y <= b.y + BRICK_H);
      canvas.style.cursor = drag ? "grabbing" : over ? "grab" : "pointer";
    };
    const onUp = (e: PointerEvent) => {
      const p = pos(e);
      if (drag) {
        const b = drag.b;
        b.x = snapX(b.x, b.w); // 放開時卡到凸點格線上
        // 如果放的位置跟別的積木重疊，就往上抬到它上面
        for (let guard = 0; guard < 60; guard++) {
          const hitBrick = bricks.find(
            (o) => o !== b && b.x < o.x + o.w * STUD && o.x < b.x + b.w * STUD && b.y < o.y + BRICK_H && o.y < b.y + BRICK_H,
          );
          if (!hitBrick) break;
          b.y = hitBrick.y - BRICK_H;
        }
        b.dragging = false;
        drag = null;
      } else if (downAt && Math.hypot(p.x - downAt.x, p.y - downAt.y) < 6) {
        addBrick(p.x, Math.min(p.y, 40) - BRICK_H);
      }
      downAt = null;
      if (reduceMotion) settle();
    };

    // 不想看動畫的人：直接算出堆好的樣子
    const settle = () => {
      for (let i = 0; i < 240; i++) step();
      draw();
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduceMotion) settle();
    });
    ro.observe(wrap);
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(wrap);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const count = W < 420 ? 16 : 26;
    apiRef.current = {
      rain: () => {
        lastLetter = 0;
        if (reduceMotion) {
          rain(count, 0);
          settle();
        } else rain(count, 90);
      },
      clear: () => {
        bricks = [];
        lastLetter = 0;
        draw();
      },
    };
    if (reduceMotion) {
      rain(count, 0);
      settle();
    } else {
      rain(count, 110);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      apiRef.current = null;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className="brick-wrap">
      <div ref={wrapRef} className="brick-playground">
        <canvas ref={canvasRef} role="img" aria-label="可以點擊放下、拖曳堆疊的積木遊樂區" style={{ touchAction: "pan-y" }} />
        <p className="brick-hint" aria-hidden="true">
          點一下放積木・拖曳重新堆疊
        </p>
      </div>
      <div className="brick-controls">
        <button
          type="button"
          className="btn btn-sm primary"
          onClick={(e) => {
            apiRef.current?.rain();
            const r = e.currentTarget.getBoundingClientRect();
            burstConfetti(r.left + r.width / 2, r.top, 40);
          }}
        >
          下一場積木雨
        </button>
        <button type="button" className="btn btn-sm" onClick={() => apiRef.current?.clear()}>
          清空
        </button>
      </div>
    </div>
  );
}

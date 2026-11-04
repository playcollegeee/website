// 彩色紙片＋小積木噴發特效（品牌四色）。不依賴外部套件。
// 開啟「減少動態效果」的人不會看到。

const COLORS = ["#fbc20f", "#5cbeaa", "#ea5754", "#5098d2"];

type Piece = { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; color: string; brick: boolean };

export function burstConfetti(originX?: number, originY?: number, count = 90) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: `${W}px`, height: `${H}px`, pointerEvents: "none", zIndex: "60" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const ox = originX ?? W / 2;
  const oy = originY ?? H * 0.6;
  const pieces: Piece[] = Array.from({ length: count }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
    const speed = 7 + Math.random() * 9;
    const brick = Math.random() < 0.3;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      w: brick ? 16 : 6 + Math.random() * 6,
      h: brick ? 10 : 10 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      brick,
    };
  });

  const start = performance.now();
  const frame = (now: number) => {
    ctx.clearRect(0, 0, W, H);
    for (const p of pieces) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.brick) {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.fillRect(-p.w / 2 + 2, -p.h / 2 - 3, 4, 3);
        ctx.fillRect(p.w / 2 - 6, -p.h / 2 - 3, 4, 3);
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }
    if (now - start < 2600) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

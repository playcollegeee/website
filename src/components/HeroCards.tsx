"use client";

/**
 * 首屏飄浮小卡（2026-11-15）
 * 設計參考：日本テレビアート https://www.ntvart.co.jp/ 首屏（飄浮作品卡、點卡片聚焦、自動輪播）。
 * 只參考互動概念，程式自行撰寫，不使用 three.js／GSAP 等套件。
 *
 * - 活動小卡分前後兩層，從下往上循環飄、慢慢翻轉；背景有 LOGO 零件從中心往外散開
 * - 滑鼠移到卡片上：卡片轉正、放大，游標旁的小圓放大顯示「看看」
 * - 點卡片＝聚焦：卡片飛到中間，背景從點擊位置擴散成這張卡的顏色，每 7 秒自動換下一張
 * - 聚焦時再點卡片或「看更多」＝前往活動頁；點其他地方、按「回首頁」或 Esc 回到飄浮狀態
 * - 「減少動態效果」：不飄、不輪播，卡片靜態排列（CSS 處理）
 * - 畫面外或分頁在背景時停止計算
 */
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type HeroCard = { id: string; title: string; tag: string; image: string; href: string };

const COLORS = ["yellow", "green", "red", "blue"] as const;
const PARTS = ["roof", "p1", "box", "cap", "p2", "base"];
const MIN_SLOTS = 8; // 活動太少時重複補滿，畫面才不會空
const MAX_SLOTS = 10;
const PARTICLES = 14;
const FLIP_SEC = 2.4;
const AUTO_MS = 7000; // 聚焦後每 7 秒換下一張

type Body = {
  front: boolean;
  x: number; // 卡片中心在舞台寬度的比例
  y: number; // 從舞台底部往上的距離（px）
  speed: number;
  scale: number;
  rx: number; rz: number;
  vx: number; vz: number;
  sway: number; swayV: number; // 左右擺動的相位與速度
  flip: number; flipIn: number; // 目前翻面角度（0 或進行中）、距離下次翻面的秒數
  h: number; // 滑鼠移上去的程度 0～1
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const sign = () => (Math.random() < 0.5 ? -1 : 1);
// 把角度收到 -180～180，轉正時走最短的方向
const norm = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

export default function HeroCards({ cards, children }: { cards: HeroCard[]; children: ReactNode }) {
  const n = cards.length;
  const slotCount = n === 0 ? 0 : Math.min(MAX_SLOTS, Math.max(MIN_SLOTS, n));
  const slots = Array.from({ length: slotCount }, (_, i) => ({ card: i % n, dup: i >= n }));

  const [focus, setFocus] = useState<number | null>(null);
  // 背景色另外記：回到飄浮狀態時顏色要留著收回去，不能一下子消失
  const [wash, setWash] = useState<string>(COLORS[0]);
  const [swap, setSwap] = useState(false); // 輪播換張時顏色才漸變；剛點開時直接是那張卡的顏色
  const heroRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const flyRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const partRefs = useRef<(HTMLImageElement | null)[]>([]);
  const cursorRef = useRef<HTMLDivElement>(null);
  const fcardRef = useRef<HTMLAnchorElement>(null);
  const hoverRef = useRef(-1);
  const focusRef = useRef<number | null>(null);
  const fromRect = useRef<DOMRect | null>(null);
  const lastBtn = useRef<HTMLButtonElement | null>(null);
  const labelRef = useRef(""); // 游標小圓裡的字
  const focusBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);

  // ---- 飄浮動畫：一個 requestAnimationFrame 迴圈同時算卡片、零件與游標小圓 ----
  useEffect(() => {
    const stage = stageRef.current;
    const hero = heroRef.current;
    if (!stage || !hero || slotCount === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let W = 0, H = 0, cw = 180, ch = 240, mobile = false;
    let bodies: Body[] = [];
    const parts = Array.from({ length: PARTICLES }, () => ({ a: rand(0, Math.PI * 2), r: Math.random(), v: rand(0.03, 0.07), spin: rand(-30, 30), rot: rand(0, 360) }));

    const layout = () => {
      const r = stage.getBoundingClientRect();
      const first = bodies.length === 0 || Math.abs(r.width - W) > 40;
      W = r.width;
      H = r.height;
      mobile = window.innerWidth <= 860;
      cw = mobile ? 114 : 180;
      ch = mobile ? 152 : 240;
      if (!first) return;
      const nf = Math.ceil(slotCount / 2);
      const nb = slotCount - nf;
      bodies = Array.from({ length: slotCount }, (_, i) => {
        const front = i % 2 === 0;
        const k = Math.floor(i / 2);
        const cnt = front ? nf : nb;
        // 電腦：兩層都在右半邊（左邊留給大標，文字才清楚）；手機鋪滿整個舞台
        const [lo, hi] = mobile ? [0.1, 0.9] : front ? [0.54, 0.93] : [0.47, 0.98];
        return {
          front,
          x: lo + ((k + 0.5) / cnt) * (hi - lo) + rand(-0.02, 0.02),
          y: ((((k * 0.38 + (front ? 0 : 0.5)) % 1) + rand(0, 0.12)) % 1) * (H + ch * 1.6) - ch * 0.3,
          speed: front ? rand(40, 62) : rand(20, 34),
          scale: front ? rand(0.92, 1.08) : rand(0.52, 0.7),
          rx: rand(-20, 20), rz: rand(-12, 12),
          vx: sign() * rand(5, 12), vz: sign() * rand(3, 8),
          sway: rand(0, Math.PI * 2), swayV: rand(0.35, 0.7),
          flip: 0, flipIn: rand(2, 14),
          h: 0,
        };
      });
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(stage);

    // 游標小圓（只有滑鼠才有）
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let mx = 0, my = 0, cx = 0, cy = 0, inside = false;
    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      if (!inside) { cx = mx; cy = my; }
      inside = true;
      const t = e.target as Element;
      labelRef.current = t.closest?.(".hc-fcard") ? "看更多" : t.closest?.(".hc-fly") ? "看看" : t.closest?.(".hc-backdrop") ? "回首頁" : "";
    };
    const onLeave = () => { inside = false; };
    if (fine) {
      hero.addEventListener("pointermove", onMove);
      hero.addEventListener("pointerleave", onLeave);
    }

    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(hero);

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible || document.hidden) return;
      const focused = focusRef.current !== null;

      if (!focused) {
        for (let i = 0; i < bodies.length; i++) {
          const b = bodies[i];
          const el = flyRefs.current[i];
          if (!el) continue;
          b.h += ((hoverRef.current === i ? 1 : 0) - b.h) * Math.min(1, dt * 8);
          const free = 1 - b.h;
          b.y += b.speed * dt * (1 - 0.9 * b.h);
          if (b.y > H + ch * 1.3) b.y = -ch * 0.3;
          b.rx += b.vx * dt * free;
          b.sway += b.swayV * dt * free;
          // 平常左右擺 ±38 度看得到照片，每隔十幾秒整圈翻一次露出背面
          b.flipIn -= dt * free;
          if (b.flipIn <= 0) {
            b.flip += dt / FLIP_SEC;
            if (b.flip >= 1) { b.flip = 0; b.flipIn = rand(9, 18); }
          }
          const e = b.flip * b.flip * (3 - 2 * b.flip);
          const ry = Math.sin(b.sway) * 38 + e * 360;
          b.rz += b.vz * dt * free;
          // 上下擺動不超過 ±24 度，左右才整圈翻
          if (Math.abs(b.rx) > 24) b.vx = -Math.sign(b.rx) * Math.abs(b.vx);
          if (Math.abs(b.rz) > 14) b.vz = -Math.sign(b.rz) * Math.abs(b.vz);
          const s = b.scale + (Math.max(b.scale, 1) * 1.1 - b.scale) * b.h;
          el.style.transform = `translate3d(${(b.x * W - cw / 2).toFixed(1)}px, ${(H - b.y).toFixed(1)}px, 0) scale(${s.toFixed(3)}) rotateX(${(b.rx * free).toFixed(1)}deg) rotateY(${(norm(ry) * free).toFixed(1)}deg) rotateZ(${(b.rz * free).toFixed(1)}deg)`;
          el.style.zIndex = b.h > 0.05 ? "5" : b.front ? "2" : "1";
          el.style.visibility = "visible";
        }
        // LOGO 零件從中心往外散開，越外面越大
        const ox = mobile ? W * 0.5 : W * 0.7;
        const oy = H * 0.5;
        const maxR = Math.max(W, H) * 0.75;
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          const el = partRefs.current[i];
          if (!el) continue;
          p.r += dt * p.v * (0.35 + p.r);
          p.rot += p.spin * dt;
          if (p.r > 1) { p.r = 0.02; p.a = rand(0, Math.PI * 2); }
          const d = p.r * maxR;
          el.style.transform = `translate3d(${(ox + Math.cos(p.a) * d).toFixed(1)}px, ${(oy + Math.sin(p.a) * d).toFixed(1)}px, 0) scale(${(0.25 + p.r * 1.1).toFixed(3)}) rotate(${p.rot.toFixed(1)}deg)`;
          el.style.opacity = String(Math.min(1, p.r * 6, (1 - p.r) * 4) * 0.8);
        }
      }

      const cur = cursorRef.current;
      if (cur && fine) {
        cx += (mx - cx) * Math.min(1, dt * 9);
        cy += (my - cy) * Math.min(1, dt * 9);
        cur.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
        cur.dataset.on = inside ? "1" : "0";
        const label = labelRef.current;
        cur.dataset.big = label ? "1" : "0";
        const sp = cur.firstElementChild;
        if (sp && label && sp.textContent !== label) sp.textContent = label;
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
    };
  }, [slotCount]);

  // ---- 聚焦 ----
  const open = (card: number, el: HTMLButtonElement) => {
    const hero = heroRef.current;
    if (!hero) return;
    const r = el.getBoundingClientRect();
    const hr = hero.getBoundingClientRect();
    hero.style.setProperty("--ox", `${r.left + r.width / 2 - hr.left}px`);
    hero.style.setProperty("--oy", `${r.top + r.height / 2 - hr.top}px`);
    fromRect.current = r;
    lastBtn.current = el;
    hoverRef.current = -1;
    labelRef.current = "";
    setSwap(false);
    setWash(COLORS[card % COLORS.length]);
    setFocus(card);
  };

  const close = useCallback(() => {
    labelRef.current = "";
    setFocus(null);
    lastBtn.current?.focus({ preventScroll: true });
  }, []);

  // 卡片從原本的位置飛到中間（先放回原位，下一格再放開讓 CSS 轉場接手）
  useLayoutEffect(() => {
    const from = fromRect.current;
    const el = fcardRef.current;
    if (focus === null || !from || !el) return;
    fromRect.current = null;
    // 手機：介紹文字可能在畫面外，捲到看得到的位置
    focusBoxRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    focusBoxRef.current?.querySelector<HTMLElement>(".hc-pill")?.focus({ preventScroll: true });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = el.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${Math.max(0.2, from.width / to.width)})`;
    void el.offsetWidth;
    el.style.transition = "";
    el.style.transform = "";
  }, [focus]);

  // 自動輪播與 Esc
  useEffect(() => {
    if (focus === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    let timer = 0;
    if (n > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timer = window.setTimeout(() => {
        const next = (focus + 1) % n;
        setSwap(true);
        setWash(COLORS[next % COLORS.length]);
        setFocus(next);
      }, AUTO_MS);
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [focus, n, close]);

  const fc = focus === null ? null : cards[focus];
  const tone = focus === null ? "" : COLORS[focus % COLORS.length];

  return (
    <section ref={heroRef} className={`hero hero2${fc ? ` is-focus tone-${tone}` : ""}`}>
      <div className={`hc-wash c-${wash}${swap ? " swap" : ""}`} aria-hidden="true" />
      <div className="hc-rings" aria-hidden="true" />

      <div className="container hero2-text">{children}</div>

      {slotCount > 0 && (
        <div className="hc-stage" ref={stageRef}>
          <div className="hc-parts" aria-hidden="true">
            {Array.from({ length: PARTICLES }, (_, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} ref={(el) => { partRefs.current[i] = el; }} src={`/brand/parts/${PARTS[i % PARTS.length]}.png`} alt="" />
            ))}
          </div>

          <div className="hc-floats" role="group" aria-label="活動與工作坊小卡，點一下看介紹">
            {slots.map((s, i) => {
              const c = cards[s.card];
              const color = COLORS[s.card % COLORS.length];
              return (
                <button
                  key={i}
                  type="button"
                  ref={(el) => { flyRefs.current[i] = el; }}
                  className={`hc-fly ${i % 2 === 0 ? "front" : "back"}${s.dup ? " dup" : ""}`}
                  aria-label={`${c.title}，看介紹`}
                  aria-hidden={s.dup || fc ? true : undefined}
                  tabIndex={s.dup || fc ? -1 : 0}
                  onClick={(e) => open(s.card, e.currentTarget)}
                  onPointerEnter={(e) => { if (e.pointerType === "mouse") hoverRef.current = i; }}
                  onPointerLeave={() => { if (hoverRef.current === i) hoverRef.current = -1; }}
                  onFocus={() => { hoverRef.current = i; }}
                  onBlur={() => { if (hoverRef.current === i) hoverRef.current = -1; }}
                >
                  <span className={`hc-face hc-front c-${color}`}>
                    <Image src={c.image} alt="" width={360} height={480} sizes="180px" priority={i < 2} />
                    <span className="hc-label">{c.title}</span>
                  </span>
                  <span className={`hc-face hc-back c-${color}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/brand/parts/${PARTS[s.card % PARTS.length]}.png`} alt="" />
                  </span>
                </button>
              );
            })}
          </div>

          {fc && (
            <>
              <button type="button" className="hc-backdrop" aria-label="回到首頁畫面" tabIndex={-1} onClick={close} />
              <div className="hc-focus" ref={focusBoxRef} role="group" aria-label="活動介紹">
                <Link href={fc.href} className="hc-fcard" ref={fcardRef} aria-label={`${fc.title}，看更多`}>
                  <Image key={fc.id} src={fc.image} alt="" width={540} height={720} sizes="(max-width: 860px) 180px, 270px" />
                </Link>
                <div className="hc-finfo" aria-live="polite">
                  <p className="hc-ftag" key={`t-${fc.id}`}>{fc.tag}</p>
                  <h2 className="hc-ftitle" key={`h-${fc.id}`}>{fc.title}</h2>
                  <div className="hc-factions">
                    <Link href={fc.href} className="hc-pill dark">看更多 →</Link>
                    <button type="button" className="hc-pill" onClick={close}>← 回首頁</button>
                  </div>
                  {n > 1 && (
                    <div className="hc-count">
                      <span>{(focus ?? 0) + 1}／{n}</span>
                      <i><b key={focus} /></i>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="hc-cursor" ref={cursorRef} aria-hidden="true">
        <span />
      </div>

      <div className="hc-scroll" aria-hidden="true">
        <span>往下看</span>
        <i />
      </div>
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import { HERO_CARDS_MAX, HERO_CARDS_MIN } from "@/lib/heroSettings";
import { setHeroCards } from "./actions";

// 首屏飄浮小卡數量：按 − ＋ 馬上存檔
export default function HeroCount({ count }: { count: number }) {
  const [val, setVal] = useState(count);
  const [msg, setMsg] = useState("");
  const [busy, start] = useTransition();
  const change = (next: number) => {
    const prev = val;
    setVal(next);
    start(async () => {
      const r = await setHeroCards(next);
      if (!r.ok) setVal(prev);
      setMsg(r.message);
    });
  };
  return (
    <span className="flag-switch">
      <button type="button" className="btn btn-sm" disabled={busy || val <= HERO_CARDS_MIN} onClick={() => change(val - 1)} aria-label="少一張">−</button>
      <strong className="hero-count" aria-live="polite">{val} 張</strong>
      <button type="button" className="btn btn-sm" disabled={busy || val >= HERO_CARDS_MAX} onClick={() => change(val + 1)} aria-label="多一張">＋</button>
      {msg && <span className="hint" role="status">{msg}</span>}
    </span>
  );
}

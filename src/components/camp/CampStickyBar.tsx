"use client";

import { useEffect, useState } from "react";

// 手機版：往下捲過首屏後，畫面底部固定一條「立即報名」（捲到營隊列表時收起，避免擋住卡片按鈕）
export default function CampStickyBar({ label, early }: { label: string; early: number | null }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const camps = document.getElementById("camps");
    const onScroll = () => {
      const r = camps?.getBoundingClientRect();
      const inCamps = r ? r.top < window.innerHeight * 0.6 && r.bottom > 120 : false;
      setShow(window.scrollY > 520 && !inCamps);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className={`cp-sticky ${show ? "show" : ""}`} aria-hidden={!show}>
      {early !== null && <span>🐣 早鳥{early === 0 ? "今天截止" : `倒數 ${early} 天`}</span>}
      <a href="#camps" className="btn primary btn-sm" tabIndex={show ? 0 : -1}>{label}</a>
    </div>
  );
}

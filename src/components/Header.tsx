"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/courses", label: "課程介紹" },
  { href: "/workshops", label: "活動與工作坊" },
  { href: "/schools", label: "學校合作" },
  { href: "/about", label: "關於玩學院" },
];

// 頁首：桌機是一排選單；手機是 logo＋「預約試聽」＋「☰ 選單」按鈕，點開才展開選單
export default function Header({ trial = false }: { trial?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // 換頁後自動收起；按 Esc 也能關
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="玩學院首頁">
          <Image src="/brand/logo-horizontal.png" alt="玩學院" width={720} height={270} priority />
        </Link>
        <div className="header-mobile">
          {trial && (
            <Link href="/contact?type=trial" className="header-cta">
              預約試聽
            </Link>
          )}
          <button type="button" className="menu-btn" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((v) => !v)}>
            <span aria-hidden="true">{open ? "✕" : "☰"}</span> 選單
          </button>
        </div>
        <nav id="site-nav" className={`nav${open ? " open" : ""}`} aria-label="主選單">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={pathname === l.href ? "page" : undefined} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <Link href={trial ? "/contact?type=trial" : "/contact"} className="cta" onClick={() => setOpen(false)}>
            {trial ? "預約試聽" : "聯絡我們"}
          </Link>
        </nav>
      </div>
    </header>
  );
}

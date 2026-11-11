"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// 右下角常駐的預約按鈕，捲到哪裡都按得到（後台與報名頁不顯示）
export default function FloatingCta() {
  const pathname = usePathname();
  // 往下捲一段才出現，避免在首屏擋住內容、和頁首的「預約試聽」重複
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // 本身就是表單的頁面不顯示
  if (["/admin", "/enroll", "/contact", "/signup"].some((p) => pathname?.startsWith(p))) return null;
  return (
    <Link href="/contact?type=trial" className={`fab${show ? "" : " hide"}`} aria-label="預約試聽" tabIndex={show ? undefined : -1}>
      <span aria-hidden="true">✦</span> 預約試聽
    </Link>
  );
}

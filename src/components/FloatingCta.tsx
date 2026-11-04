"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 右下角常駐的預約按鈕，捲到哪裡都按得到（後台與報名頁不顯示）
export default function FloatingCta() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/enroll")) return null;
  return (
    <Link href="/contact?type=trial" className="fab" aria-label="預約試聽">
      <span aria-hidden="true">✦</span> 預約試聽
    </Link>
  );
}

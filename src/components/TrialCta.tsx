import Link from "next/link";
import { getSiteFlags } from "@/lib/siteFlags";

// 「預約試聽」按鈕：後台關閉預約試聽時改成「課程諮詢」（2026-11-15 先關閉，等準備開課再打開）
export default async function TrialCta({ className = "btn primary", href = "/contact?type=trial", label = "預約試聽" }: { className?: string; href?: string; label?: string }) {
  const { trial } = await getSiteFlags();
  return trial ? (
    <Link href={href} className={className}>{label}</Link>
  ) : (
    <Link href="/contact?type=other" className={className}>課程諮詢</Link>
  );
}

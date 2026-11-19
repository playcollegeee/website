import Link from "next/link";
import type { NoticeBar } from "@/lib/noticeTypes";

// 頂部公告列：內容在後台「官網區塊開關 → 頂部公告列」設定（預設自動顯示最近一場報名中的活動）
export default function AnnouncementBar({ bar }: { bar: NoticeBar | null }) {
  if (!bar) return null;
  const external = bar.href.startsWith("http");
  return (
    <div className="announce">
      <div className="container announce-inner">
        <span>{bar.text}</span>
        {external ? (
          <a href={bar.href} target="_blank" rel="noopener noreferrer">{bar.cta} →</a>
        ) : (
          <Link href={bar.href}>{bar.cta} →</Link>
        )}
      </div>
    </div>
  );
}

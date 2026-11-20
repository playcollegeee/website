"use client";

/**
 * 右下角「最新消息小卡」（2026-11-20）
 * 設計參考：日本テレビアート https://www.ntvart.co.jp/ 右下角的最新消息小卡（可按 ✕ 關閉）。程式自行撰寫。
 * - 放最近一場報名中的活動（後台「官網區塊開關」可關閉或指定哪一場），取代原本右下角的預約按鈕
 * - 按 ✕ 關掉後，同一場活動不再出現（記在瀏覽器）；有新的一場報名時會再出現
 * - 進站動畫播完才滑上來；報名頁、聯絡頁等本身就是表單的頁面，以及冬夏令營頁（有自己的報名列）不顯示
 */
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { OpenRunSummary } from "@/lib/noticeTypes";

const KEY = "pc_news_closed";
// 冬夏令營頁手機版底部已有自己的報名列，不重疊
const HIDE_ON = ["/enroll", "/contact", "/signup", "/camp"];

export default function NewsCard({ item }: { item: OpenRunSummary }) {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let closed = "";
    try {
      closed = localStorage.getItem(KEY) ?? "";
    } catch {}
    if (closed === item.runId) return;
    const t = window.setTimeout(() => setShow(true), 1600);
    return () => window.clearTimeout(t);
  }, [item.runId]);

  if (HIDE_ON.some((p) => pathname?.startsWith(p))) return null;
  if (!show) return null;

  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, item.runId);
    } catch {}
  };

  return (
    <aside className="news-card" aria-label="最新消息">
      <Link href={item.href} className="news-body">
        <span className="news-thumb">
          {item.image ? (
            <Image src={item.image} alt="" width={160} height={160} sizes="80px" />
          ) : (
            // 沒有照片時放 LOGO 零件
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/brand/parts/roof.png" alt="" className="news-part" />
          )}
        </span>
        <span className="news-text">
          <span className="news-meta">
            <span className="news-tag">報名中</span>
            {item.date}
            {item.area ? `・${item.area}` : ""}
          </span>
          <strong className="news-title">{item.title}</strong>
          <span className="news-go">立即報名 →</span>
        </span>
      </Link>
      <button type="button" className="news-x" onClick={close} aria-label="關閉最新消息">
        <span aria-hidden="true">✕</span>
      </button>
    </aside>
  );
}

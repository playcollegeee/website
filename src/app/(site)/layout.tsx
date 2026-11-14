import AnnouncementBar from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCta from "@/components/FloatingCta";
import { Analytics } from "@vercel/analytics/next";
import SiteIntro from "@/components/SiteIntro";
import { getSiteFlags } from "@/lib/siteFlags";

// 官網各頁共用的外框：公告列、頁首、頁尾、浮動預約按鈕
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // 官網區塊開關（後台「官網區塊開關」修改）
  const { trial } = await getSiteFlags();
  return (
    <>
      <SiteIntro />
      <a href="#main" className="skip">跳到主要內容</a>
      <AnnouncementBar />
      <Header trial={trial} />
      <main id="main">{children}</main>
      <Footer trial={trial} />
      <FloatingCta trial={trial} />
      {/* 流量統計（不使用 Cookie）：只放在官網頁面，後台與讀卡站不統計。要在 Vercel 專案的 Analytics 頁按 Enable 才會開始記錄 */}
      <Analytics />
    </>
  );
}

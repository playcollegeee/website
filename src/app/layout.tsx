import type { Metadata } from "next";
// 字型：Noto Sans TC 由網站自己提供（分成很多小片段，瀏覽器只抓頁面用到的字），
// 讓 Windows 與 Android 看到的字體和 Mac、iPhone 一樣整齊
import "@fontsource-variable/noto-sans-tc";
import "./globals.css";
import { site } from "@/lib/content";

export const metadata: Metadata = {
  metadataBase: new URL("https://playcollegeee.com"),
  title: {
    default: `${site.name} ${site.nameEn}｜台中兒童 LEGO 機器人、3D 列印與美術創作`,
    template: `%s｜${site.name}`,
  },
  description: `${site.taglineShort}。${site.name} ${site.nameEn}：台中兒童 STEAM 教室，LEGO 樂高機器人、3D 列印造物、美術創作與多元探索課程。`,
  openGraph: {
    siteName: `${site.name} ${site.nameEn}`,
    locale: "zh_TW",
    type: "website",
  },
  // 分享到 LINE／FB／X 時顯示大張預覽圖（圖片放在各頁資料夾的 opengraph-image.jpg）
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      {/* 官網的頁首頁尾放在 (site)/layout.tsx；後台與讀卡站不顯示 */}
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { site } from "@/lib/content";

export const metadata: Metadata = {
  metadataBase: new URL("https://playcollegeee.com"),
  title: {
    default: `${site.name} ${site.nameEn}｜台中兒童 LEGO 機器人、3D 列印與美術創作`,
    template: `%s｜${site.name}`,
  },
  description: `${site.name}透過「玩」幫助孩子發現興趣與能力：LEGO 樂高機器人、3D 列印造物、美術創作與多元探索課程。${site.tagline}`,
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

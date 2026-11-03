import type { Metadata } from "next";
import "./globals.css";
import AnnouncementBar from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { site } from "@/lib/content";

export const metadata: Metadata = {
  metadataBase: new URL("https://playcollegeee.com"),
  title: {
    default: `${site.name} ${site.nameEn}｜台中兒童 LEGO 機器人、3D 列印與美術創作`,
    template: `%s｜${site.name}`,
  },
  description: `${site.name}透過「玩」幫助孩子發現興趣與能力：LEGO 樂高機器人、3D 列印造物、美術創作與多元探索課程。${site.tagline}`,
  openGraph: {
    siteName: site.name,
    locale: "zh_TW",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      <body>
        <AnnouncementBar />
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}

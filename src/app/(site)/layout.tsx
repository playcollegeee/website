import AnnouncementBar from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCta from "@/components/FloatingCta";

// 官網各頁共用的外框：公告列、頁首、頁尾、浮動預約按鈕
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="skip">跳到主要內容</a>
      <AnnouncementBar />
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <FloatingCta />
    </>
  );
}

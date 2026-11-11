import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    // 登入頁、讀卡站、後台不列在這裡（等於公開路徑清單）；它們各自用 noindex 標頭不讓搜尋引擎收錄
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: "https://playcollegeee.com/sitemap.xml",
  };
}

import type { NextConfig } from "next";

// 內容安全政策（CSP）：只允許載入自己網站與 Supabase 照片的資源，
// 萬一頁面被塞進惡意程式碼，瀏覽器也不會去連外部網站。
// Next.js 會放少量內嵌程式，所以 script 需要 'unsafe-inline'；其餘來源都鎖住。
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co",
  "media-src 'self' data: blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // 不在回應裡透露用了什麼框架
  poweredByHeader: false,
  // 官網照片放在 Supabase Storage，允許 next/image 讀取
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  // 後台上傳照片：瀏覽器先縮圖，伺服器端最多收 4 MB
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // 安全標頭：避免網站被嵌入別人的頁面、限制可載入的資源與瀏覽器權限
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // 瀏覽器兩年內一律用 https 連線（不含子網域，信箱主機不受影響）
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // 老師線上打卡需要定位；相機、麥克風、付款等一律關閉
          { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;

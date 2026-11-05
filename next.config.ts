import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 官網照片放在 Supabase Storage，允許 next/image 讀取
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  // 後台上傳照片：瀏覽器先縮圖，伺服器端最多收 4 MB
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // 安全標頭：避免網站被嵌入別人的頁面、減少常見攻擊面
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

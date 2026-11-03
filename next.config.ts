import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

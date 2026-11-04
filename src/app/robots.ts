import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/login", "/kiosk"] }],
    sitemap: "https://playcollegeee.com/sitemap.xml",
  };
}

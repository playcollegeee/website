import type { MetadataRoute } from "next";

// 乾淨的網站地圖，取代舊 WordPress 被植入的垃圾網址
const base = "https://playcollegeee.com";
const paths = ["", "/courses", "/workshops", "/workshops/all", "/schools", "/about", "/contact", "/enroll", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }));
}

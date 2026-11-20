import type { MetadataRoute } from "next";
import { getCurrentSeason } from "@/lib/camps";
import { getShowcaseThemes } from "@/lib/events";

// 網站地圖：固定頁面＋工作坊主題頁；冬夏令營要有公開的一季才列（準備中的空頁不給搜尋引擎）
const base = "https://playcollegeee.com";
const paths = ["", "/courses", "/workshops", "/workshops/all", "/schools", "/about", "/contact", "/enroll", "/privacy"];

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const out: MetadataRoute.Sitemap = paths.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }));
  const season = await getCurrentSeason().catch(() => null);
  if (season) out.push({ url: `${base}/camp`, changeFrequency: "weekly", priority: 0.8 });
  const themes = await getShowcaseThemes().then((r) => r.themes).catch(() => []);
  for (const t of themes) out.push({ url: `${base}/workshops/${t.slug}`, changeFrequency: "monthly", priority: 0.5 });
  return out;
}

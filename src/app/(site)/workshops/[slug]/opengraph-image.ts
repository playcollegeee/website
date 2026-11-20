import { getThemeBySlug } from "@/lib/events";
import { OG_SIZE, posterOg } from "@/lib/ogPoster";

// 工作坊主題頁的分享預覽圖：主題封面，沒有就用第一張照片
export const size = OG_SIZE;
export const contentType = "image/jpeg";
export const alt = "玩學院工作坊照片";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getThemeBySlug(slug).catch(() => null);
  return posterOg(d ? d.theme.cover_url || d.photos[0]?.url || null : null);
}

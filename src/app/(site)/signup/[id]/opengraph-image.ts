import { getRunBundle } from "@/lib/events";
import { OG_SIZE, posterOg } from "@/lib/ogPoster";
import { isUuid } from "@/lib/supabase";

// 報名頁的分享預覽圖：用這次開課的海報（沒有就用主題封面）
export const size = OG_SIZE;
export const contentType = "image/jpeg";
export const alt = "玩學院活動海報";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = isUuid(id) ? await getRunBundle(id).catch(() => null) : null;
  const cover = b && b.run.status !== "draft" ? b.run.cover_url || b.theme.cover_url : null;
  return posterOg(cover);
}

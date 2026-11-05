// 官網照片（成果紀錄、教室現場）：優先讀資料庫 site_photos，讀不到就用 content.ts 的內建資料，
// 這樣資料庫還沒設定或暫時連不上時，官網也不會開天窗。
import { gallery, highlights } from "./content";
import { authHeaders, supabaseConfig } from "./supabase";

export type PhotoSection = "highlights" | "gallery";
export type SitePhoto = {
  id: string;
  section: PhotoSection;
  title: string;
  tag: string | null;
  body: string | null;
  color: "yellow" | "green" | "red" | "blue";
  image_url: string;
  storage_path: string | null;
  width: number;
  height: number;
  sort: number;
  published: boolean;
};

export const PHOTO_TAG = "site-photos";
export const PHOTO_BUCKET = "site-photos";

function fallback(section: PhotoSection): SitePhoto[] {
  if (section === "highlights")
    return highlights.map((h, i) => ({
      id: `builtin-h${i}`, section, title: h.title, tag: h.date, body: h.text, color: h.color,
      image_url: h.image, storage_path: null, width: 825, height: 1100, sort: i, published: true,
    }));
  return gallery.map((g, i) => ({
    id: `builtin-g${i}`, section, title: g.alt, tag: null, body: null, color: "yellow" as const,
    image_url: g.src, storage_path: null, width: g.w, height: g.h, sort: i, published: true,
  }));
}

// 官網用：只取「顯示在官網」的照片，快取一小時；後台一改就立刻更新（updateTag）
export async function getPublishedPhotos(section: PhotoSection): Promise<SitePhoto[]> {
  const cfg = supabaseConfig();
  if (!cfg) return fallback(section);
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/site_photos?section=eq.${section}&published=eq.true&order=sort,created_at&select=*`,
      { headers: authHeaders(cfg.key), next: { tags: [PHOTO_TAG], revalidate: 3600 } },
    );
    if (!res.ok) return fallback(section);
    const rows = (await res.json()) as SitePhoto[];
    return rows; // 資料表存在就以資料庫為準（全部隱藏時該區塊就不顯示）
  } catch {
    return fallback(section);
  }
}

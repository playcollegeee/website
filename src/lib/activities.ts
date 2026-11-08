// 官網「活動與工作坊」：優先讀資料庫 activities，讀不到就用 content.ts 的內建資料（官網不會開天窗）
import { programs } from "./content";
import { authHeaders, supabaseConfig } from "./supabase";

import { ACTIVITY_TAG, type Activity } from "./activityTypes";
export * from "./activityTypes";

function fallback(): Activity[] {
  return programs.map((p, i) => ({
    id: `builtin-${i}`,
    title: p.name,
    kind: p.name.includes("營隊") ? "camp" : "workshop",
    audience: p.name === "積木故事屋" ? "family" : "kids",
    audience_text: p.audience,
    summary: p.summary,
    tags: p.tags,
    schedule_text: null,
    price_text: null,
    signup: "contact",
    signup_url: null,
    image_url: p.image ?? null,
    storage_path: null,
    width: 640,
    height: 480,
    sort: i,
    published: true,
  }));
}

// 官網用：只取「顯示在官網」的活動，快取一小時；後台一改就立刻更新（updateTag）
export async function getPublishedActivities(): Promise<Activity[]> {
  const cfg = supabaseConfig();
  if (!cfg) return fallback();
  try {
    const res = await fetch(`${cfg.url}/rest/v1/activities?published=eq.true&order=sort,created_at&select=*`, {
      headers: authHeaders(cfg.key),
      next: { tags: [ACTIVITY_TAG], revalidate: 3600 },
    });
    if (!res.ok) return fallback();
    return (await res.json()) as Activity[];
  } catch {
    return fallback();
  }
}

// 報名按鈕要去哪裡
export function signupHref(a: Activity): string | null {
  if (a.signup === "none") return null;
  if (a.signup === "link") return a.signup_url || null;
  return `/contact?type=workshop&activity=${encodeURIComponent(a.title)}`;
}

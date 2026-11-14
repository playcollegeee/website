// 官網區塊開關：存在資料表 site_settings（key = sections），後台「官網區塊開關」修改
// 讀不到資料表時用預設值（2026-11-15 使用者決定：預約試聽、跑馬燈、選擇任務先關閉）
import { authHeaders, supabaseConfig } from "./supabase";

export type SiteFlags = { trial: boolean; ribbon: boolean; quests: boolean };
export const SITE_FLAGS_TAG = "site-settings";
export const DEFAULT_FLAGS: SiteFlags = { trial: false, ribbon: false, quests: false };

export const FLAG_INFO: { key: keyof SiteFlags; label: string; note: string }[] = [
  { key: "trial", label: "預約試聽", note: "頁首、右下角浮動按鈕、首頁與各頁的「預約試聽」按鈕、詢問表單的「預約試聽」選項。關閉時改成「課程諮詢」。" },
  { key: "ribbon", label: "標語跑馬燈", note: "首頁數據帶下方與頁尾上方的黃色／藍色文字跑馬燈。" },
  { key: "quests", label: "選擇任務", note: "首頁「孩子喜歡什麼？從這裡出發」5 張興趣卡片。" },
];

export async function getSiteFlags(): Promise<SiteFlags> {
  const cfg = supabaseConfig();
  if (!cfg) return DEFAULT_FLAGS;
  try {
    const res = await fetch(`${cfg.url}/rest/v1/site_settings?key=eq.sections&select=value`, {
      headers: authHeaders(cfg.key),
      next: { tags: [SITE_FLAGS_TAG], revalidate: 3600 },
    });
    if (!res.ok) return DEFAULT_FLAGS;
    const rows = (await res.json()) as { value: Partial<SiteFlags> }[];
    return { ...DEFAULT_FLAGS, ...(rows[0]?.value ?? {}) };
  } catch {
    return DEFAULT_FLAGS;
  }
}

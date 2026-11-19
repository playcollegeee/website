"use server";

import { revalidatePath, updateTag } from "next/cache";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, sbGet, sbInsert, sbPatch } from "@/lib/supabase";
import { NOTICE_CTA_MAX, NOTICE_HREF_MAX, NOTICE_TEXT_MAX, validHref, type NewsSetting, type NoticeSetting } from "@/lib/noticeTypes";
import { FLAG_INFO, HERO_CARDS_MAX, HERO_CARDS_MIN, SITE_FLAGS_TAG, clampHeroCards, type SiteFlags } from "@/lib/siteFlags";

// 打開／關閉官網區塊（管理員）
export async function setFlag(key: keyof SiteFlags, on: boolean): Promise<{ ok: boolean; message: string }> {
  const staff = await requireStaff(true);
  if (!FLAG_INFO.some((f) => f.key === key)) return { ok: false, message: "項目不正確" };
  const rows = await sbGet<{ value: Partial<SiteFlags> }[]>("site_settings?key=eq.sections&select=value");
  if (!rows[0]) return { ok: false, message: "找不到設定，請先執行 migration 0021" };
  await sbPatch("site_settings?key=eq.sections", { value: { ...rows[0].value, [key]: on }, updated_by: staff.id, updated_at: new Date().toISOString() });
  await audit(actorOf(staff), "site.section", `site_settings:sections`, { key, on });
  updateTag(SITE_FLAGS_TAG);
  revalidatePath("/", "layout");
  return { ok: true, message: on ? "已打開，官網馬上顯示" : "已關閉，官網馬上隱藏" };
}

// 首屏飄浮小卡的數量（管理員）
export async function setHeroCards(count: number): Promise<{ ok: boolean; message: string }> {
  const staff = await requireStaff(true);
  const n = Math.round(Number(count));
  if (!Number.isFinite(n) || n < HERO_CARDS_MIN || n > HERO_CARDS_MAX) return { ok: false, message: `請填 ${HERO_CARDS_MIN}～${HERO_CARDS_MAX}` };
  try {
    await sbInsert("site_settings", { key: "hero", value: { cards: clampHeroCards(n) }, updated_by: staff.id, updated_at: new Date().toISOString() }, "key");
  } catch {
    return { ok: false, message: "存不進去，請先執行 migration 0021" };
  }
  await audit(actorOf(staff), "site.hero", "site_settings:hero", { cards: n });
  updateTag(SITE_FLAGS_TAG);
  revalidatePath("/", "layout");
  return { ok: true, message: `已改成 ${n} 張，官網馬上更新` };
}

async function saveSetting(key: string, value: object, staffId: string) {
  await sbInsert("site_settings", { key, value, updated_by: staffId, updated_at: new Date().toISOString() }, "key");
}

// 頂部公告列（管理員）
export async function setNotice(n: NoticeSetting): Promise<{ ok: boolean; message: string }> {
  const staff = await requireStaff(true);
  const mode = n.mode === "custom" || n.mode === "off" ? n.mode : "auto";
  const text = String(n.text ?? "").trim().slice(0, NOTICE_TEXT_MAX);
  const cta = String(n.cta ?? "").trim().slice(0, NOTICE_CTA_MAX);
  const href = String(n.href ?? "").trim().slice(0, NOTICE_HREF_MAX);
  if (mode === "custom") {
    if (!text) return { ok: false, message: "請填公告文字" };
    if (!cta) return { ok: false, message: "請填按鈕文字" };
    if (!validHref(href)) return { ok: false, message: "連結請填本站路徑（例如 /workshops）或 https:// 開頭的網址" };
  }
  try {
    await saveSetting("notice", { mode, text, cta, href }, staff.id);
  } catch {
    return { ok: false, message: "存不進去，請稍後再試" };
  }
  await audit(actorOf(staff), "site.notice", "site_settings:notice", { mode, text, cta, href });
  updateTag(SITE_FLAGS_TAG);
  revalidatePath("/", "layout");
  return { ok: true, message: mode === "off" ? "已關閉，官網不顯示公告列" : "已儲存，官網馬上更新" };
}

// 右下角最新消息小卡（管理員）
export async function setNews(n: NewsSetting): Promise<{ ok: boolean; message: string }> {
  const staff = await requireStaff(true);
  const runId = n.runId && /^[0-9a-f-]{36}$/.test(n.runId) ? n.runId : null;
  try {
    await saveSetting("news", { on: !!n.on, runId }, staff.id);
  } catch {
    return { ok: false, message: "存不進去，請稍後再試" };
  }
  await audit(actorOf(staff), "site.news", "site_settings:news", { on: !!n.on, runId });
  updateTag(SITE_FLAGS_TAG);
  revalidatePath("/", "layout");
  return { ok: true, message: n.on ? "已儲存，官網馬上更新" : "已關閉，官網不顯示小卡" };
}

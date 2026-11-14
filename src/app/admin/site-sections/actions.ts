"use server";

import { revalidatePath, updateTag } from "next/cache";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, sbGet, sbPatch } from "@/lib/supabase";
import { FLAG_INFO, SITE_FLAGS_TAG, type SiteFlags } from "@/lib/siteFlags";

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

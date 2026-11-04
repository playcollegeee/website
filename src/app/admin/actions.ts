"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { sbFetch } from "@/lib/supabase";
import { LEAD_STATUSES } from "./labels";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 更新詢問狀態，並寫一筆操作紀錄
export async function updateLeadStatus(formData: FormData) {
  const h = await headers();
  if (!isAdminAuthorized(h.get("authorization"))) throw new Error("未授權");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const from = String(formData.get("from") ?? "");
  if (!UUID.test(id) || !LEAD_STATUSES.some((s) => s.value === status)) throw new Error("資料不正確");
  if (status === from) return;

  const res = await sbFetch(`leads?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("更新失敗");

  await sbFetch("audit_log", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ actor: "admin", action: "lead.status", target: `leads:${id}`, detail: { from, to: status } }),
  }).catch(() => undefined);

  revalidatePath("/admin");
}

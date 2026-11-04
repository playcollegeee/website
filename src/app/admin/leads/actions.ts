"use server";

import { revalidatePath } from "next/cache";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, sbFetch } from "@/lib/supabase";
import { LEAD_STATUSES } from "./labels";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 更新詢問狀態，並寫一筆操作紀錄
export async function updateLeadStatus(formData: FormData) {
  const staff = await requireStaff(true);

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

  await audit(actorOf(staff), "lead.status", `leads:${id}`, { from, to: status });
  revalidatePath("/admin/leads");
}

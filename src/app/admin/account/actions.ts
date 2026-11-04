"use server";

import { actorOf, requireStaff } from "@/lib/staff";
import { audit, sbAuthFetch, sbGet } from "@/lib/supabase";

export async function changePassword(_prev: { ok?: string; error?: string }, fd: FormData) {
  const staff = await requireStaff();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next.length < 10) return { error: "新密碼至少 10 個字元。" };
  if (next !== String(fd.get("confirm") ?? "")) return { error: "兩次輸入的新密碼不一樣。" };
  if (!staff.email) return { error: "這個帳號沒有設定 Email。" };

  // 先用舊密碼確認是本人
  const check = await sbAuthFetch("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: staff.email, password: current }),
  });
  if (!check.ok) return { error: "目前的密碼不正確。" };

  const rows = await sbGet<{ auth_user_id: string | null }[]>(`teachers?id=eq.${staff.id}&select=auth_user_id`);
  const authId = rows[0]?.auth_user_id;
  if (!authId) return { error: "帳號對應有誤，請聯絡管理員。" };
  const res = await sbAuthFetch(`admin/users/${authId}`, { method: "PUT", body: JSON.stringify({ password: next }) });
  if (!res.ok) return { error: `更新失敗（${res.status}），密碼可能太簡單。` };
  await audit(actorOf(staff), "staff.password", `teachers:${staff.id}`);
  return { ok: "密碼已更新。" };
}

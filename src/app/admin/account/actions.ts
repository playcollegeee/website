"use server";

import { actorOf, requireStaff } from "@/lib/staff";
import { revalidatePath } from "next/cache";
import { audit, sbAuthFetch, sbGet, sbPatch } from "@/lib/supabase";

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

// 老師自己改稱呼（讀卡站、後台、會議都顯示這個名字；真實姓名由管理員在老師帳號改）
export async function changeNickname(_prev: { ok?: string; error?: string }, fd: FormData) {
  const staff = await requireStaff();
  const nick = String(fd.get("nickname") ?? "").replace(/\s+/g, " ").trim();
  if (!nick) return { error: "請填稱呼。" };
  if (nick.length > 20) return { error: "稱呼最多 20 個字。" };
  if (/[<>]/.test(nick)) return { error: "稱呼不能有 < > 符號。" };
  await sbPatch(`teachers?id=eq.${staff.id}`, { nickname: nick });
  await audit(actorOf(staff), "staff.nickname", `teachers:${staff.id}`, { from: staff.nickname, to: nick });
  revalidatePath("/admin", "layout");
  return { ok: `已改成「${nick}」。` };
}

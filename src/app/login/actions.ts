"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_COOKIE, STAFF_MAX_AGE, signToken } from "@/lib/session";
import { audit, sbAuthFetch, sbGet, sbPatch, supabaseConfig } from "@/lib/supabase";

type Teacher = { id: string; auth_user_id: string | null; is_admin: boolean; active: boolean };

// 只允許站內路徑，避免被導到外部網站
function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/admin") && !s.startsWith("//") ? s : "/admin";
}

export type LoginState = { error: string; email: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fail = (error: string) => ({ error, email }); // 失敗時保留 Email，不用重打
  if (!supabaseConfig()) return fail("系統尚未設定 Supabase。");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return fail("請輸入 Email 與密碼。");

  // 1. 交給 Supabase Auth 確認帳密
  const res = await sbAuthFetch("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    if (res.status === 429) return fail("嘗試太多次，請稍後再試。");
    return fail("Email 或密碼不正確。");
  }
  const auth = (await res.json()) as { user?: { id: string } };
  const authId = auth.user?.id;
  if (!authId) return fail("登入失敗，請再試一次。");

  // 2. 確認這個 Email 是在職的老師
  const rows = await sbGet<Teacher[]>(
    `teachers?email=eq.${encodeURIComponent(email)}&select=id,auth_user_id,is_admin,active`,
  );
  const t = rows[0];
  if (!t || !t.active) return fail("這個帳號還沒有開通老師權限，請聯絡管理員。");
  if (t.auth_user_id && t.auth_user_id !== authId) return fail("帳號對應有誤，請聯絡管理員。");
  if (!t.auth_user_id) await sbPatch(`teachers?id=eq.${t.id}`, { auth_user_id: authId });

  const token = await signToken({ t: t.id, a: t.is_admin, exp: Math.floor(Date.now() / 1000) + STAFF_MAX_AGE });
  const jar = await cookies();
  jar.set(STAFF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STAFF_MAX_AGE,
  });
  await audit(`teacher:${t.id}`, "staff.login", `teachers:${t.id}`);
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  const jar = await cookies();
  jar.delete(STAFF_COOKIE);
  redirect("/login");
}

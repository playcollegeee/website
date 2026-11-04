// 後台權限：取得目前登入的老師；沒登入就導向登入頁。
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { STAFF_COOKIE, verifyToken, type StaffToken } from "./session";
import { sbGet, supabaseConfig } from "./supabase";

export type Staff = {
  id: string;
  name: string;
  nickname: string | null;
  email: string | null;
  is_admin: boolean;
};

export const getStaff = cache(async (): Promise<Staff | null> => {
  if (!supabaseConfig()) return null;
  const jar = await cookies();
  const tok = await verifyToken<StaffToken>(jar.get(STAFF_COOKIE)?.value);
  if (!tok) return null;
  // 每次都回資料庫確認：老師被停用就立刻失效
  const rows = await sbGet<Staff[]>(
    `teachers?id=eq.${tok.t}&active=eq.true&select=id,name,nickname,email,is_admin`,
  ).catch(() => []);
  return rows[0] ?? null;
});

// 頁面與動作一開頭都要呼叫：requireStaff() 一般老師；requireStaff(true) 只限管理員
export async function requireStaff(adminOnly = false): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  if (adminOnly && !staff.is_admin) notFound();
  return staff;
}

export const actorOf = (s: Staff) => `teacher:${s.id}`;

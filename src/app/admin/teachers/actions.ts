"use server";

import { revalidatePath } from "next/cache";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbAuthFetch, sbGet, sbInsert, sbPatch } from "@/lib/supabase";
import { optStr, str } from "@/lib/admin";

export type TeacherFormState = { ok?: string; error?: string };

// 管理員幫老師開帳號：建立 Supabase 登入帳號＋老師資料，給一組臨時密碼
export async function createTeacher(_prev: TeacherFormState, fd: FormData): Promise<TeacherFormState> {
  const staff = await requireStaff(true);
  const name = str(fd, "name", 40);
  const email = str(fd, "email", 120).toLowerCase();
  const password = str(fd, "password", 72);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "請填寫姓名與正確的 Email。" };
  if (password.length < 10) return { error: "臨時密碼至少 10 個字元。" };

  const exist = await sbGet<{ id: string }[]>(`teachers?email=eq.${encodeURIComponent(email)}&select=id`);
  if (exist[0]) return { error: "這個 Email 已經是老師了。" };

  const res = await sbAuthFetch("admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  let authId: string | null = null;
  if (res.ok) {
    authId = ((await res.json()) as { id: string }).id;
  } else if (res.status !== 422) {
    return { error: `建立登入帳號失敗（${res.status}）。` };
  }
  // 422＝這個 Email 已有登入帳號（例如之前建過）：直接連結，登入時會自動對上

  const t = await sbInsert<{ id: string }>("teachers", {
    name,
    nickname: optStr(fd, "nickname", 20),
    email,
    phone: optStr(fd, "phone", 20),
    is_admin: fd.get("is_admin") === "on",
    auth_user_id: authId,
    active: true,
  });
  await audit(actorOf(staff), "teacher.create", `teachers:${t.id}`, { email, is_admin: fd.get("is_admin") === "on" });
  revalidatePath("/admin/teachers");
  return {
    ok: authId
      ? `已建立。請把 Email 和臨時密碼交給 ${name}，登入後到右上角自己的名字改密碼。`
      : `已建立老師資料。這個 Email 原本就有登入帳號，請 ${name} 用原本的密碼登入。`,
  };
}

export async function updateTeacher(fd: FormData) {
  const staff = await requireStaff(true);
  const id = str(fd, "id", 40);
  if (!isUuid(id)) throw new Error("資料不正確");
  const isAdmin = fd.get("is_admin") === "on";
  const active = fd.get("active") === "on";
  if (id === staff.id && (!isAdmin || !active)) throw new Error("不能取消自己的管理員權限或停用自己");
  await sbPatch(`teachers?id=eq.${id}`, {
    name: str(fd, "name", 40) || undefined,
    nickname: optStr(fd, "nickname", 20),
    phone: optStr(fd, "phone", 20),
    is_admin: isAdmin,
    active,
  });
  await audit(actorOf(staff), "teacher.update", `teachers:${id}`, { is_admin: isAdmin, active });
  revalidatePath("/admin/teachers");
}

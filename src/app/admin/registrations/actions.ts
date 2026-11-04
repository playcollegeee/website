"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbGet, sbInsert, sbPatch } from "@/lib/supabase";
import { LEVEL_NAME, optStr, str } from "@/lib/admin";

type Req = {
  id: string; status: string; child_name: string; child_nickname: string; child_level: string;
  child_birth_year: number | null; child_gender: string | null; child_school: string | null;
  guardian_name: string; guardian_relation: string | null; guardian_phone: string; guardian_email: string | null;
  pickup_name: string | null; pickup_relation: string | null; pickup_phone: string | null;
  consent_version: string; consent_at: string; photo_scope: string; marketing_consent: boolean;
  care_notes: string | null; care_consent: boolean; message: string | null;
};

// 同一支電話視為同一位家長；沒有就新建
async function guardianFor(name: string, phone: string, email: string | null, extra: object = {}): Promise<string> {
  const found = await sbGet<{ id: string }[]>(`guardians?phone=eq.${encodeURIComponent(phone)}&select=id&limit=1`);
  if (found[0]) {
    if (Object.keys(extra).length) await sbPatch(`guardians?id=eq.${found[0].id}`, extra);
    return found[0].id;
  }
  const g = await sbInsert<{ id: string }>("guardians", { name, phone, email, ...extra });
  return g.id;
}

// 審核通過：建立家長、學生（自動建立遊戲角色）、可接送的人，選擇性加入班級
export async function approveRegistration(fd: FormData) {
  const staff = await requireStaff();
  const id = str(fd, "id", 40);
  if (!isUuid(id)) throw new Error("資料不正確");
  const rows = await sbGet<Req[]>(`registration_requests?id=eq.${id}&select=*`);
  const r = rows[0];
  if (!r) throw new Error("找不到這筆報名");
  if (r.status !== "pending") redirect(`/admin/registrations/${id}`);

  const nickname = str(fd, "nickname", 20) || r.child_nickname;
  const level = LEVEL_NAME[str(fd, "level", 20)] ? str(fd, "level", 20) : r.child_level;

  const guardianId = await guardianFor(r.guardian_name, r.guardian_phone, r.guardian_email,
    r.marketing_consent ? { marketing_consent: true, marketing_consent_at: r.consent_at } : {});

  const scoped = r.photo_scope !== "none";
  const student = await sbInsert<{ id: string }>("students", {
    name: r.child_name,
    nickname,
    level,
    birth_year: r.child_birth_year,
    gender: r.child_gender,
    school: r.child_school,
    consent_at: r.consent_at,
    consent_by: guardianId,
    consent_method: "online",
    consent_version: r.consent_version,
    photo_scope: r.photo_scope,
    photo_consent: scoped,
    photo_consent_at: scoped ? r.consent_at : null,
    care_notes: r.care_consent ? r.care_notes : null,
    care_consent_at: r.care_consent && r.care_notes ? r.consent_at : null,
  });
  await sbInsert("student_guardians", {
    student_id: student.id, guardian_id: guardianId, relation: r.guardian_relation, is_primary: true, can_pickup: true,
  });
  if (r.pickup_name && r.pickup_phone && r.pickup_phone !== r.guardian_phone) {
    const pid = await guardianFor(r.pickup_name, r.pickup_phone, null);
    await sbInsert("student_guardians", {
      student_id: student.id, guardian_id: pid, relation: r.pickup_relation, is_primary: false, can_pickup: true,
    }, "student_id,guardian_id");
  }
  const classId = str(fd, "class_id", 40);
  if (isUuid(classId)) {
    await sbInsert("enrollments", { student_id: student.id, class_id: classId, status: "active" }, "student_id,class_id");
  }
  await sbPatch(`registration_requests?id=eq.${id}`, {
    status: "approved", student_id: student.id, reviewed_by: staff.id, reviewed_at: new Date().toISOString(),
    review_note: optStr(fd, "review_note", 300),
  });
  await audit(actorOf(staff), "registration.approve", `registration_requests:${id}`, { student: student.id, class: classId || null });
  revalidatePath("/admin/registrations");
  revalidatePath("/admin/students");
  redirect(`/admin/students/${student.id}?created=1`);
}

export async function rejectRegistration(fd: FormData) {
  const staff = await requireStaff();
  const id = str(fd, "id", 40);
  if (!isUuid(id)) throw new Error("資料不正確");
  await sbPatch(`registration_requests?id=eq.${id}&status=eq.pending`, {
    status: "rejected", reviewed_by: staff.id, reviewed_at: new Date().toISOString(),
    review_note: optStr(fd, "review_note", 300),
  });
  await audit(actorOf(staff), "registration.reject", `registration_requests:${id}`);
  revalidatePath("/admin/registrations");
  redirect("/admin/registrations");
}

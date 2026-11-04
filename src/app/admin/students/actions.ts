"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbDelete, sbGet, sbInsert, sbPatch } from "@/lib/supabase";
import { LEVEL_NAME, normalizeUid, optStr, str } from "@/lib/admin";
import { CONSENT_VERSION } from "@/lib/consent";


function studentFields(fd: FormData) {
  const level = str(fd, "level", 20);
  if (!LEVEL_NAME[level]) throw new Error("請選擇階段");
  const name = str(fd, "name", 40);
  const nickname = str(fd, "nickname", 20);
  if (!name || !nickname) throw new Error("請填寫姓名與角色暱稱");
  const by = str(fd, "birth_year", 4);
  return {
    name,
    nickname,
    level,
    birth_year: /^\d{4}$/.test(by) ? Number(by) : null,
    gender: optStr(fd, "gender", 10),
    school: optStr(fd, "school", 60),
    notes: optStr(fd, "notes", 1000),
  };
}

// 照片公開範圍與照護注意事項（過敏等需家長同意才可記錄）
type ConsentBefore = { photo_scope: string; photo_consent_at: string | null; care_consent_at: string | null };
function consentFields(fd: FormData, before?: ConsentBefore) {
  const now = new Date().toISOString();
  const scopeRaw = str(fd, "photo_scope", 10);
  const photo_scope = scopeRaw === "works" || scopeRaw === "all" ? scopeRaw : "none";
  const care_notes = optStr(fd, "care_notes", 500);
  if (care_notes && fd.get("care_consent") !== "on") throw new Error("記錄照護注意事項前，需要家長同意");
  return {
    photo_scope,
    photo_consent: photo_scope !== "none",
    photo_consent_at: photo_scope === "none" ? null : before && before.photo_scope === photo_scope ? before.photo_consent_at : now,
    care_notes,
    care_consent_at: care_notes ? before?.care_consent_at ?? now : null,
  };
}

// 電話只留數字，方便比對同一位家長
const cleanPhone = (v: string) => v.replace(/[^0-9+]/g, "").slice(0, 20);

async function findOrCreateGuardian(fd: FormData, prefix: string): Promise<string> {
  const name = str(fd, `${prefix}name`, 40);
  const phone = cleanPhone(str(fd, `${prefix}phone`, 30));
  if (!name || phone.length < 8) throw new Error("請填寫家長姓名與電話");
  const found = await sbGet<{ id: string }[]>(`guardians?phone=eq.${encodeURIComponent(phone)}&select=id&limit=1`);
  if (found[0]) return found[0].id; // 同一支電話視為同一位家長（兄弟姊妹共用）
  const g = await sbInsert<{ id: string }>("guardians", {
    name,
    phone,
    email: optStr(fd, `${prefix}email`, 120),
    note: optStr(fd, `${prefix}note`, 300),
  });
  return g.id;
}

export async function createStudent(fd: FormData) {
  const staff = await requireStaff();
  if (fd.get("consent") !== "on") throw new Error("需要家長簽署個資同意書才能建檔");
  const fields = studentFields(fd);
  const guardianId = await findOrCreateGuardian(fd, "g_");
  const consent = consentFields(fd);
  const now = new Date().toISOString();

  const s = await sbInsert<{ id: string }>("students", {
    ...fields,
    consent_at: now,
    consent_by: guardianId,
    consent_method: str(fd, "consent_method", 10) === "online" ? "online" : "paper",
    consent_version: CONSENT_VERSION,
    ...consent,
  });
  await sbInsert("student_guardians", {
    student_id: s.id,
    guardian_id: guardianId,
    relation: optStr(fd, "g_relation", 10),
    is_primary: true,
    can_pickup: true,
  });
  await audit(actorOf(staff), "student.create", `students:${s.id}`, { guardian: guardianId });
  revalidatePath("/admin/students");
  redirect(`/admin/students/${s.id}?created=1`);
}

export async function updateStudent(fd: FormData) {
  const staff = await requireStaff();
  const id = str(fd, "id", 40);
  if (!isUuid(id)) throw new Error("資料不正確");
  const fields = studentFields(fd);
  const before = await sbGet<ConsentBefore[]>(`students?id=eq.${id}&select=photo_scope,photo_consent_at,care_consent_at`);
  const consent = consentFields(fd, before[0]);
  await sbPatch(`students?id=eq.${id}`, {
    ...fields,
    active: fd.get("active") === "on",
    ...consent,
    updated_at: new Date().toISOString(),
  });
  await audit(actorOf(staff), "student.update", `students:${id}`, { fields: Object.keys(fields), photo_scope: consent.photo_scope, care: !!consent.care_notes });
  revalidatePath(`/admin/students/${id}`);
  redirect(`/admin/students/${id}?saved=1`);
}

export async function addGuardian(fd: FormData) {
  const staff = await requireStaff();
  const studentId = str(fd, "student_id", 40);
  if (!isUuid(studentId)) throw new Error("資料不正確");
  const guardianId = await findOrCreateGuardian(fd, "g_");
  await sbInsert(
    "student_guardians",
    {
      student_id: studentId,
      guardian_id: guardianId,
      relation: optStr(fd, "g_relation", 10),
      is_primary: false,
      can_pickup: fd.get("can_pickup") === "on",
    },
    "student_id,guardian_id",
  );
  await audit(actorOf(staff), "student.guardian.add", `students:${studentId}`, { guardian: guardianId });
  revalidatePath(`/admin/students/${studentId}`);
}

export async function updateGuardian(fd: FormData) {
  const staff = await requireStaff();
  const studentId = str(fd, "student_id", 40);
  const guardianId = str(fd, "guardian_id", 40);
  if (!isUuid(studentId) || !isUuid(guardianId)) throw new Error("資料不正確");
  const phone = cleanPhone(str(fd, "phone", 30));
  if (!str(fd, "name", 40) || phone.length < 8) throw new Error("請填寫家長姓名與電話");
  await sbPatch(`guardians?id=eq.${guardianId}`, {
    name: str(fd, "name", 40),
    phone,
    email: optStr(fd, "email", 120),
    note: optStr(fd, "note", 300),
    updated_at: new Date().toISOString(),
  });
  await sbPatch(`student_guardians?student_id=eq.${studentId}&guardian_id=eq.${guardianId}`, {
    relation: optStr(fd, "relation", 10),
    can_pickup: fd.get("can_pickup") === "on",
  });
  if (fd.get("is_primary") === "on") {
    await sbPatch(`student_guardians?student_id=eq.${studentId}`, { is_primary: false });
    await sbPatch(`student_guardians?student_id=eq.${studentId}&guardian_id=eq.${guardianId}`, { is_primary: true });
  }
  await audit(actorOf(staff), "guardian.update", `guardians:${guardianId}`, { student: studentId });
  revalidatePath(`/admin/students/${studentId}`);
}

// 解除學生與家長的連結（家長資料本身保留，可能還有其他孩子）
export async function unlinkGuardian(fd: FormData) {
  const staff = await requireStaff();
  const studentId = str(fd, "student_id", 40);
  const guardianId = str(fd, "guardian_id", 40);
  if (!isUuid(studentId) || !isUuid(guardianId)) throw new Error("資料不正確");
  const links = await sbGet<{ guardian_id: string }[]>(`student_guardians?student_id=eq.${studentId}&select=guardian_id`);
  if (links.length <= 1) throw new Error("每位學生至少要有一位家長");
  await sbDelete(`student_guardians?student_id=eq.${studentId}&guardian_id=eq.${guardianId}`);
  await audit(actorOf(staff), "student.guardian.remove", `students:${studentId}`, { guardian: guardianId });
  revalidatePath(`/admin/students/${studentId}`);
}

export async function enrollStudent(fd: FormData) {
  const staff = await requireStaff();
  const studentId = str(fd, "student_id", 40);
  const classId = str(fd, "class_id", 40);
  if (!isUuid(studentId) || !isUuid(classId)) throw new Error("請選擇班級");
  await sbInsert("enrollments", { student_id: studentId, class_id: classId, status: "active" }, "student_id,class_id");
  await audit(actorOf(staff), "enrollment.add", `classes:${classId}`, { student: studentId });
  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath(`/admin/classes/${classId}`);
}

export async function setEnrollmentStatus(fd: FormData) {
  const staff = await requireStaff();
  const studentId = str(fd, "student_id", 40);
  const classId = str(fd, "class_id", 40);
  const status = str(fd, "status", 20);
  if (!isUuid(studentId) || !isUuid(classId) || !["active", "cancelled", "completed"].includes(status))
    throw new Error("資料不正確");
  await sbPatch(`enrollments?student_id=eq.${studentId}&class_id=eq.${classId}`, { status });
  await audit(actorOf(staff), "enrollment.status", `classes:${classId}`, { student: studentId, status });
  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath(`/admin/classes/${classId}`);
}

// 綁卡：學生或老師（owner = student:<id> 或 teacher:<id>）
export async function bindCard(fd: FormData) {
  const staff = await requireStaff();
  const uid = normalizeUid(str(fd, "uid", 60));
  const owner = str(fd, "owner", 60);
  const [kind, ownerId] = owner.split(":");
  if (uid.length < 4 || uid.length > 40) throw new Error("卡號格式不正確");
  if (!isUuid(ownerId) || (kind !== "student" && kind !== "teacher")) throw new Error("請選擇持卡人");
  if (kind === "teacher" && !staff.is_admin) throw new Error("只有管理員可以綁定老師卡");
  const exist = await sbGet<{ uid: string; revoked_at: string | null }[]>(`cards?uid=eq.${uid}&select=uid,revoked_at`);
  if (exist[0] && !exist[0].revoked_at) throw new Error("這張卡已經綁定給別人，請先停用");
  const row = {
    uid,
    student_id: kind === "student" ? ownerId : null,
    teacher_id: kind === "teacher" ? ownerId : null,
    kind: str(fd, "kind", 5) === "qr" ? "qr" : "nfc",
    label: optStr(fd, "label", 30),
    issued_at: new Date().toISOString(),
    revoked_at: null,
  };
  if (exist[0]) await sbPatch(`cards?uid=eq.${uid}`, row);
  else await sbInsert("cards", row);
  await audit(actorOf(staff), "card.bind", `cards:${uid}`, { owner });
  revalidatePath("/admin/cards");
  if (kind === "student") revalidatePath(`/admin/students/${ownerId}`);
  const back = str(fd, "back", 120);
  if (back.startsWith("/admin")) redirect(back);
}

export async function revokeCard(fd: FormData) {
  const staff = await requireStaff();
  const uid = normalizeUid(str(fd, "uid", 60));
  if (!uid) throw new Error("資料不正確");
  const card = await sbGet<{ teacher_id: string | null }[]>(`cards?uid=eq.${uid}&select=teacher_id`);
  if (card[0]?.teacher_id && !staff.is_admin) throw new Error("只有管理員可以停用老師卡");
  await sbPatch(`cards?uid=eq.${uid}`, { revoked_at: new Date().toISOString() });
  await audit(actorOf(staff), "card.revoke", `cards:${uid}`);
  revalidatePath("/admin/cards");
  const back = str(fd, "back", 120);
  if (back.startsWith("/admin/students/")) revalidatePath(back);
}

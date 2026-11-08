"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbDelete, sbFetch, sbInsert, sbPatch } from "@/lib/supabase";
import { str } from "@/lib/admin";
import { schoolYear } from "@/lib/eventTypes";

export type CtResult = { ok: boolean; message: string };
const COLORS = ["gray", "yellow", "green", "red", "blue"];
const refresh = (familyId?: string) => {
  revalidatePath("/admin/contacts");
  if (familyId) revalidatePath(`/admin/contacts/${familyId}`);
};

export async function createTag(fd: FormData): Promise<CtResult> {
  const staff = await requireStaff(true);
  const name = str(fd, "name", 20);
  const color = str(fd, "color", 10) || "gray";
  if (!name) return { ok: false, message: "請填標籤名稱" };
  if (!COLORS.includes(color)) return { ok: false, message: "顏色不正確" };
  try {
    await sbInsert("contact_tags", { name, color });
  } catch {
    return { ok: false, message: "已經有同名的標籤" };
  }
  await audit(actorOf(staff), "contact.tag.create", "contact_tags", { name });
  refresh();
  return { ok: true, message: "已新增標籤" };
}

export async function updateTag(id: string, name: string, color: string): Promise<CtResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id) || !name.trim() || !COLORS.includes(color)) return { ok: false, message: "資料不正確" };
  await sbPatch(`contact_tags?id=eq.${id}`, { name: name.trim().slice(0, 20), color });
  await audit(actorOf(staff), "contact.tag.update", `contact_tags:${id}`, { name });
  refresh();
  return { ok: true, message: "已更新" };
}

export async function deleteTag(id: string): Promise<CtResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id)) return { ok: false, message: "資料不正確" };
  await sbDelete(`contact_tags?id=eq.${id}`);
  await audit(actorOf(staff), "contact.tag.delete", `contact_tags:${id}`);
  refresh();
  return { ok: true, message: "已刪除標籤" };
}

// 名單勾選多人，一次加上或拿掉標籤
export async function bulkTag(fd: FormData): Promise<CtResult> {
  const staff = await requireStaff(true);
  const tagId = str(fd, "tag_id", 40);
  const mode = str(fd, "mode", 10);
  const ids = fd.getAll("person").map(String).filter(isUuid).slice(0, 500);
  if (!isUuid(tagId)) return { ok: false, message: "請選標籤" };
  if (ids.length === 0) return { ok: false, message: "請先勾選名單裡的人" };
  if (mode === "remove") {
    await sbDelete(`contact_person_tags?tag_id=eq.${tagId}&person_id=in.(${ids.join(",")})`);
  } else {
    const res = await sbFetch("contact_person_tags?on_conflict=person_id,tag_id", {
      method: "POST",
      headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify(ids.map((person_id) => ({ person_id, tag_id: tagId, created_by: staff.id }))),
    });
    if (!res.ok) return { ok: false, message: "加標籤失敗" };
  }
  await audit(actorOf(staff), mode === "remove" ? "contact.tag.remove" : "contact.tag.add", `contact_tags:${tagId}`, { people: ids.length });
  refresh();
  return { ok: true, message: `已${mode === "remove" ? "拿掉" : "加上"}標籤（${ids.length} 人）` };
}

export async function togglePersonTag(personId: string, tagId: string, on: boolean, familyId: string): Promise<CtResult> {
  const staff = await requireStaff(true);
  if (!isUuid(personId) || !isUuid(tagId)) return { ok: false, message: "資料不正確" };
  if (on) {
    await sbFetch("contact_person_tags?on_conflict=person_id,tag_id", {
      method: "POST",
      headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify({ person_id: personId, tag_id: tagId, created_by: staff.id }),
    });
  } else {
    await sbDelete(`contact_person_tags?person_id=eq.${personId}&tag_id=eq.${tagId}`);
  }
  await audit(actorOf(staff), on ? "contact.tag.add" : "contact.tag.remove", `contact_people:${personId}`, { tagId });
  refresh(isUuid(familyId) ? familyId : undefined);
  return { ok: true, message: "" };
}

export async function saveFamily(fd: FormData): Promise<CtResult> {
  const staff = await requireStaff(true);
  const id = str(fd, "id", 40);
  if (!isUuid(id)) return { ok: false, message: "資料不正確" };
  const name = str(fd, "name", 40);
  if (!name) return { ok: false, message: "聯絡人姓名不可空白" };
  const marketing = fd.get("marketing") === "on";
  const was = str(fd, "was_marketing", 5) === "1";
  await sbPatch(`contact_families?id=eq.${id}`, {
    name,
    email: str(fd, "email", 120) || null,
    social_name: str(fd, "social_name", 60) || null,
    note: str(fd, "note", 500) || null,
    marketing,
    ...(marketing && !was ? { marketing_at: new Date().toISOString() } : {}),
    ...(!marketing ? { marketing_at: null } : {}),
  });
  await audit(actorOf(staff), "contact.family.update", `contact_families:${id}`, { marketing });
  refresh(id);
  return { ok: true, message: "已儲存" };
}

export async function savePerson(fd: FormData): Promise<CtResult> {
  const staff = await requireStaff(true);
  const id = str(fd, "id", 40);
  const familyId = str(fd, "family_id", 40);
  if (!isUuid(id) || !isUuid(familyId)) return { ok: false, message: "資料不正確" };
  const g = str(fd, "grade", 4);
  const grade = g === "" ? null : Number(g);
  await sbPatch(`contact_people?id=eq.${id}&family_id=eq.${familyId}`, {
    name: str(fd, "name", 40),
    grade: grade !== null && Number.isInteger(grade) ? grade : null,
    grade_year: grade !== null ? schoolYear() : null,
    note: str(fd, "note", 300) || null,
  });
  await audit(actorOf(staff), "contact.person.update", `contact_people:${id}`);
  refresh(familyId);
  return { ok: true, message: "已儲存" };
}

// 家長要求刪除個資時使用：刪掉名單資料（報名紀錄的帳務欄位依稅法保留）
export async function deleteFamily(id: string): Promise<CtResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id)) return { ok: false, message: "資料不正確" };
  await sbDelete(`contact_families?id=eq.${id}`);
  await audit(actorOf(staff), "contact.family.delete", `contact_families:${id}`);
  revalidatePath("/admin/contacts");
  redirect("/admin/contacts");
}

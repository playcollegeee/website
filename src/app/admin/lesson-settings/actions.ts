"use server";

import { revalidatePath } from "next/cache";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbDelete, sbGet, sbInsert, sbPatch, sbRpc } from "@/lib/supabase";
import { LEVEL_NAME, optStr, str } from "@/lib/admin";
import { TAG_KIND_LABEL, cleanTagName } from "@/lib/lessons";

const MAJORS = ["lego", "3d", "art"];
const done = () => {
  revalidatePath("/admin/lesson-settings");
  revalidatePath("/admin/lessons");
};
const levelsOf = (fd: FormData) => fd.getAll("levels").map(String).filter((l) => LEVEL_NAME[l]);
const sortOf = (fd: FormData) => {
  const n = Number(str(fd, "sort", 4));
  return Number.isInteger(n) && n >= 0 && n <= 999 ? n : 0;
};

// ---------- 課程類別（只有管理員） ----------
export async function createCategory(fd: FormData) {
  const staff = await requireStaff(true);
  const major = str(fd, "major", 10);
  const name = str(fd, "name", 30);
  if (!MAJORS.includes(major) || !name) throw new Error("請填寫類別名稱");
  const dup = await sbGet<{ id: string }[]>(`lesson_categories?major=eq.${major}&name=eq.${encodeURIComponent(name)}&select=id`);
  if (dup.length) throw new Error("這個主修已經有同名的類別");
  const c = await sbInsert<{ id: string }>("lesson_categories", {
    major, name, levels: levelsOf(fd), sort: sortOf(fd), description: optStr(fd, "description", 300),
  });
  await audit(actorOf(staff), "lesson_category.create", `lesson_categories:${c.id}`, { major, name });
  done();
}

export async function updateCategory(fd: FormData) {
  const staff = await requireStaff(true);
  const id = str(fd, "id", 40);
  const name = str(fd, "name", 30);
  if (!isUuid(id) || !name) throw new Error("請填寫類別名稱");
  const cur = await sbGet<{ major: string }[]>(`lesson_categories?id=eq.${id}&select=major`);
  if (!cur[0]) throw new Error("找不到這個類別");
  const dup = await sbGet<{ id: string }[]>(
    `lesson_categories?major=eq.${cur[0].major}&name=eq.${encodeURIComponent(name)}&id=neq.${id}&select=id`,
  );
  if (dup.length) throw new Error("這個主修已經有同名的類別");
  const patch = {
    name, levels: levelsOf(fd), sort: sortOf(fd), description: optStr(fd, "description", 300), active: fd.get("active") === "on",
  };
  await sbPatch(`lesson_categories?id=eq.${id}`, patch);
  await audit(actorOf(staff), "lesson_category.update", `lesson_categories:${id}`, patch);
  done();
}

// ---------- 標籤詞庫（只有管理員） ----------
export async function createTag(fd: FormData) {
  const staff = await requireStaff(true);
  const kind = str(fd, "kind", 12);
  const name = cleanTagName(str(fd, "name", 60));
  if (!TAG_KIND_LABEL[kind] || !name) throw new Error("請填寫標籤名稱");
  const dup = await sbGet<{ id: string }[]>(`tags?kind=eq.${kind}&name=ilike.${encodeURIComponent(name)}&select=id`);
  if (dup.length) throw new Error("已經有這個標籤了");
  const t = await sbInsert<{ id: string }>("tags", { kind, name, created_by: staff.id });
  await audit(actorOf(staff), "tag.create", `tags:${t.id}`, { kind, name });
  done();
}

export async function renameTag(fd: FormData) {
  const staff = await requireStaff(true);
  const id = str(fd, "id", 40);
  const name = cleanTagName(str(fd, "name", 60));
  if (!isUuid(id) || !name) throw new Error("請填寫標籤名稱");
  const cur = await sbGet<{ kind: string; name: string }[]>(`tags?id=eq.${id}&select=kind,name`);
  if (!cur[0]) throw new Error("找不到這個標籤");
  const dup = await sbGet<{ id: string }[]>(
    `tags?kind=eq.${cur[0].kind}&name=ilike.${encodeURIComponent(name)}&id=neq.${id}&select=id`,
  );
  if (dup.length) throw new Error("已經有同名的標籤，請改用「合併」");
  await sbPatch(`tags?id=eq.${id}`, { name });
  await audit(actorOf(staff), "tag.rename", `tags:${id}`, { from: cur[0].name, to: name });
  done();
}

// 合併同義標籤：把 from 的教案全部改掛到 into，再刪掉 from
export async function mergeTag(fd: FormData) {
  const staff = await requireStaff(true);
  const from = str(fd, "id", 40);
  const into = str(fd, "into", 40);
  if (!isUuid(from) || !isUuid(into)) throw new Error("請選擇要合併到哪個標籤");
  const moved = await sbRpc<number>("merge_tags", { p_from: from, p_into: into });
  await audit(actorOf(staff), "tag.merge", `tags:${into}`, { from, moved });
  done();
}

// 只能刪除沒有教案在用的標籤
export async function deleteTag(fd: FormData) {
  const staff = await requireStaff(true);
  const id = str(fd, "id", 40);
  if (!isUuid(id)) throw new Error("資料不正確");
  const used = await sbGet<{ lesson_id: string }[]>(`lesson_tags?tag_id=eq.${id}&select=lesson_id&limit=1`);
  if (used.length) throw new Error("還有教案在用這個標籤，請改用「合併」");
  await sbDelete(`tags?id=eq.${id}`);
  await audit(actorOf(staff), "tag.delete", `tags:${id}`);
  done();
}

// ---------- 器材盒組與常用材料（只有管理員）：教案表單「器材與材料」可直接點選 ----------
const presetKind = (fd: FormData) => (str(fd, "kind", 10) === "material" ? "material" : "kit");

export async function createPreset(fd: FormData) {
  const staff = await requireStaff(true);
  const name = str(fd, "name", 80).trim();
  if (!name) throw new Error("請填寫名稱");
  const dup = await sbGet<{ id: string }[]>(`material_presets?name=eq.${encodeURIComponent(name)}&select=id`);
  if (dup.length) throw new Error("已經有同名的項目");
  const p = await sbInsert<{ id: string }>("material_presets", { name, kind: presetKind(fd), sort: sortOf(fd) });
  await audit(actorOf(staff), "material_preset.create", `material_presets:${p.id}`, { name });
  done();
}

export async function updatePreset(fd: FormData) {
  const staff = await requireStaff(true);
  const id = str(fd, "id", 40);
  const name = str(fd, "name", 80).trim();
  if (!isUuid(id) || !name) throw new Error("請填寫名稱");
  const dup = await sbGet<{ id: string }[]>(`material_presets?name=eq.${encodeURIComponent(name)}&id=neq.${id}&select=id`);
  if (dup.length) throw new Error("已經有同名的項目");
  const patch = { name, kind: presetKind(fd), sort: sortOf(fd), active: fd.get("active") === "on" };
  await sbPatch(`material_presets?id=eq.${id}`, patch);
  await audit(actorOf(staff), "material_preset.update", `material_presets:${id}`, patch);
  done();
}

// 刪除只會讓它不再出現在點選清單；已經寫進教案的器材文字不受影響
export async function deletePreset(fd: FormData) {
  const staff = await requireStaff(true);
  const id = str(fd, "id", 40);
  if (!isUuid(id)) throw new Error("資料不正確");
  await sbDelete(`material_presets?id=eq.${id}`);
  await audit(actorOf(staff), "material_preset.delete", `material_presets:${id}`, {});
  done();
}

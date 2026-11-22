"use server";

import { revalidatePath } from "next/cache";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbDelete, sbGet, sbInsert, sbObjectExists, sbRemoveFile, sbSignUpload } from "@/lib/supabase";
import { allow, TOO_MANY } from "@/lib/rateLimit";
import { canEditPlan } from "@/lib/plans";
import { REF_BUCKET, REF_MAX_BYTES } from "@/lib/planRefs";

// 參考網址及檔案（migration 0024）：所有老師都可以貼網址、上傳檔案；刪除限貼的人、規劃負責人、管理員。
// 檔案流程：startRefUpload 拿上傳網址 → 瀏覽器直接 PUT 到 Supabase（私人 bucket）→ finishRefUpload 確認檔案在了才建資料

type Result = { ok: boolean; message: string };
const fail = (e: unknown): Result => ({ ok: false, message: e instanceof Error ? e.message : "處理失敗，請再試一次" });
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const refresh = (planId: string) => {
  revalidatePath(`/admin/plans/${planId}`);
  revalidatePath("/admin/meetings/[id]", "page");
};

async function loadPlan(id: string) {
  if (!isUuid(id)) throw new Error("資料不正確");
  const p = (await sbGet<{ id: string; owner_id: string | null; owner_ids?: string[] | null; created_by: string | null }[]>(
    `plans?id=eq.${id}&select=id,owner_id,owner_ids,created_by`,
  ))[0];
  if (!p) throw new Error("找不到這份規劃，可能已被刪除");
  return p;
}
async function meetingOf(meetingId: string | undefined, planId: string) {
  if (!meetingId) return null;
  if (!isUuid(meetingId)) throw new Error("資料不正確");
  const m = await sbGet<{ plan_id: string | null }[]>(`meetings?id=eq.${meetingId}&select=plan_id`);
  if (m[0]?.plan_id !== planId) throw new Error("找不到這場會議");
  return meetingId;
}

// 貼網址：沒寫 https:// 的自動補上
export async function addRefLink(input: { planId: string; meetingId?: string; url: string; title: string }): Promise<Result> {
  try {
    const staff = await requireStaff();
    const plan = await loadPlan(input.planId);
    const meetingId = await meetingOf(input.meetingId, plan.id);
    let url = text(input.url, 2000);
    if (!url) return { ok: false, message: "請貼上網址" };
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) throw new Error();
    } catch {
      return { ok: false, message: "網址看起來不正確，請確認後再貼一次" };
    }
    const r = await sbInsert<{ id: string }>("plan_refs", {
      plan_id: plan.id, meeting_id: meetingId, kind: "link", url, title: text(input.title, 120), created_by: staff.id,
    });
    await audit(actorOf(staff), "plan.ref_link", `plan_refs:${r.id}`, { plan: plan.id, meeting: meetingId });
    refresh(plan.id);
    return { ok: true, message: "已加入" };
  } catch (e) {
    return fail(e);
  }
}

// 副檔名只留英數，檔名另外存 file_name（中文檔名下載時還原）
const extOf = (name: string) => (name.match(/\.([a-z0-9]{1,8})$/i)?.[1] ?? "").toLowerCase();

export async function startRefUpload(input: { planId: string; name: string; size: number }): Promise<Result & { path?: string; url?: string }> {
  try {
    const staff = await requireStaff();
    const plan = await loadPlan(input.planId);
    const name = text(input.name, 200);
    if (!name) return { ok: false, message: "檔名不正確" };
    if (!(Number.isFinite(input.size) && input.size > 0)) return { ok: false, message: `「${name}」是空檔案` };
    if (input.size > REF_MAX_BYTES) return { ok: false, message: `「${name}」超過 ${REF_MAX_BYTES / 1024 / 1024} MB，請先壓縮或改貼雲端硬碟連結` };
    if (!(await allow("refUpload", staff.id))) return { ok: false, message: TOO_MANY };
    const ext = extOf(name);
    const path = `${plan.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext ? `.${ext}` : ""}`;
    const url = await sbSignUpload(REF_BUCKET, path);
    return { ok: true, message: "", path, url };
  } catch (e) {
    return fail(e);
  }
}

export async function finishRefUpload(input: {
  planId: string; meetingId?: string; path: string; name: string; size: number; mime: string; title?: string;
}): Promise<Result> {
  try {
    const staff = await requireStaff();
    const plan = await loadPlan(input.planId);
    const meetingId = await meetingOf(input.meetingId, plan.id);
    // 路徑一定要是這份規劃資料夾底下、startRefUpload 產生的格式
    if (!new RegExp(`^${plan.id}/\\d+-[0-9a-f]{8}(\\.[a-z0-9]{1,8})?$`).test(input.path)) {
      return { ok: false, message: "檔案資料不正確" };
    }
    if (!(await sbObjectExists(REF_BUCKET, input.path))) return { ok: false, message: "檔案沒有上傳成功，請再試一次" };
    const r = await sbInsert<{ id: string }>("plan_refs", {
      plan_id: plan.id, meeting_id: meetingId, kind: "file", title: text(input.title, 120),
      file_path: input.path, file_name: text(input.name, 200) || "檔案",
      file_size: Math.min(REF_MAX_BYTES, Math.max(0, Math.round(Number(input.size) || 0))),
      mime: text(input.mime, 100) || null, created_by: staff.id,
    });
    await audit(actorOf(staff), "plan.ref_file", `plan_refs:${r.id}`, { plan: plan.id, meeting: meetingId, size: input.size });
    refresh(plan.id);
    return { ok: true, message: "已上傳" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRef(id: string): Promise<Result> {
  try {
    const staff = await requireStaff();
    if (!isUuid(id)) return { ok: false, message: "資料不正確" };
    const r = (await sbGet<{ id: string; plan_id: string; created_by: string | null; file_path: string | null }[]>(
      `plan_refs?id=eq.${id}&select=id,plan_id,created_by,file_path`,
    ))[0];
    if (!r) return { ok: false, message: "找不到，可能已被刪除" };
    const plan = await loadPlan(r.plan_id);
    if (!(r.created_by === staff.id || canEditPlan(plan, staff))) {
      return { ok: false, message: "只有貼的人、規劃負責人或管理員可以刪除" };
    }
    await sbDelete(`plan_refs?id=eq.${id}`);
    if (r.file_path) await sbRemoveFile(REF_BUCKET, r.file_path);
    await audit(actorOf(staff), "plan.ref_delete", `plan_refs:${id}`, { plan: r.plan_id });
    refresh(r.plan_id);
    return { ok: true, message: "已刪除" };
  } catch (e) {
    return fail(e);
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbDelete, sbFetch, sbGet } from "@/lib/supabase";
import { canEditPlan } from "@/lib/plans";

type Result = { ok: boolean; message: string };

// 設定這場會議的小幫手老師（可以改、刪任何便利貼與分區框）
export async function setHelpers(meetingId: string, teacherIds: string[]): Promise<Result> {
  try {
    const staff = await requireStaff();
    if (!isUuid(meetingId) || !Array.isArray(teacherIds) || teacherIds.length > 30 || !teacherIds.every(isUuid)) {
      return { ok: false, message: "資料不正確" };
    }
    const rows = await sbGet<{ id: string; created_by: string | null; plan: { owner_id: string | null; created_by: string | null } | null }[]>(
      `meetings?id=eq.${meetingId}&select=id,created_by,plan:plans(owner_id,created_by)`,
    );
    const m = rows[0];
    if (!m) return { ok: false, message: "找不到這場會議" };
    if (!(staff.is_admin || m.created_by === staff.id || (m.plan && canEditPlan(m.plan, staff)))) {
      return { ok: false, message: "只有會議建立者、規劃負責人或管理員可以設定小幫手" };
    }
    const ids = [...new Set(teacherIds)].filter((t) => t !== m.created_by);
    if (ids.length) {
      const ok = await sbGet<{ id: string }[]>(`teachers?id=in.(${ids.join(",")})&active=eq.true&select=id`);
      if (ok.length !== ids.length) return { ok: false, message: "有老師帳號已停用，請重新整理" };
    }
    await sbDelete(`meeting_helpers?meeting_id=eq.${meetingId}`);
    if (ids.length) {
      const res = await sbFetch("meeting_helpers", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(ids.map((t) => ({ meeting_id: meetingId, teacher_id: t, added_by: staff.id }))),
      });
      if (!res.ok) throw new Error(`儲存失敗（${res.status}）`);
    }
    await audit(actorOf(staff), "meeting.helpers", `meetings:${meetingId}`, { helpers: ids });
    revalidatePath(`/admin/meetings/${meetingId}`);
    return { ok: true, message: ids.length ? "已更新小幫手老師" : "已清除小幫手老師" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "儲存失敗" };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbGet, sbInsert, sbPatch } from "@/lib/supabase";
import { ATT_LABEL, optStr, str } from "@/lib/admin";

// 老師手動點名：出席／遲到／請假／缺席（觸發器會自動發裝備與經驗值）
export async function setAttendance(fd: FormData) {
  const staff = await requireStaff();
  const sessionId = str(fd, "session_id", 40);
  const studentId = str(fd, "student_id", 40);
  const status = str(fd, "status", 10);
  if (!isUuid(sessionId) || !isUuid(studentId) || !ATT_LABEL[status]) throw new Error("資料不正確");
  const here = status === "present" || status === "late";

  const exist = await sbGet<{ id: string; status: string; checked_in_at: string | null }[]>(
    `attendance?session_id=eq.${sessionId}&student_id=eq.${studentId}&select=id,status,checked_in_at`,
  );
  if (exist[0]) {
    if (exist[0].status === status) return;
    await sbPatch(`attendance?id=eq.${exist[0].id}`, {
      status,
      recorded_by: staff.id,
      ...(here && !exist[0].checked_in_at ? { checked_in_at: new Date().toISOString() } : {}),
    });
  } else {
    await sbInsert("attendance", {
      session_id: sessionId, student_id: studentId, status, source: "manual", recorded_by: staff.id,
      checked_in_at: here ? new Date().toISOString() : null,
    });
  }
  await audit(actorOf(staff), "attendance.set", `sessions:${sessionId}`, { student: studentId, from: exist[0]?.status ?? null, to: status });
  revalidatePath(`/admin/sessions/${sessionId}`);
}

export async function setAttendanceNote(fd: FormData) {
  const staff = await requireStaff();
  const id = str(fd, "id", 40);
  if (!isUuid(id)) throw new Error("資料不正確");
  await sbPatch(`attendance?id=eq.${id}`, { note: optStr(fd, "note", 300) });
  await audit(actorOf(staff), "attendance.note", `attendance:${id}`);
  const sid = str(fd, "session_id", 40);
  if (isUuid(sid)) revalidatePath(`/admin/sessions/${sid}`);
}

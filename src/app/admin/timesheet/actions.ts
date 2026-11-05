"use server";

import { revalidatePath } from "next/cache";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbGet, sbInsert, sbPatch } from "@/lib/supabase";
import { OPEN_WINDOW_HOURS, fromTaipeiLocal, optStr, str } from "@/lib/admin";

export type PunchState = { ok?: string; error?: string };


function coords(fd: FormData) {
  const lat = Number(str(fd, "lat", 20));
  const lng = Number(str(fd, "lng", 20));
  const acc = Number(str(fd, "acc", 10));
  const ok = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0);
  return ok ? { lat, lng, acc: Number.isFinite(acc) ? Math.round(acc) : null } : null;
}

// 線上打卡：沒有進行中的紀錄 → 上班；有 → 下班。時間一律用伺服器時間。
export async function punch(_prev: PunchState, fd: FormData): Promise<PunchState> {
  const staff = await requireStaff();
  const since = new Date(Date.now() - OPEN_WINDOW_HOURS * 3600_000).toISOString();
  const open = await sbGet<{ id: string; check_in_at: string }[]>(
    `teacher_attendance?teacher_id=eq.${staff.id}&check_out_at=is.null&check_in_at=gte.${since}&order=check_in_at.desc&limit=1&select=id,check_in_at`,
  );
  const gps = coords(fd);
  const now = new Date();
  const hm = now.toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false });

  if (open[0]) {
    if (now.getTime() - new Date(open[0].check_in_at).getTime() < 60_000) return { error: "剛剛才上班打卡，1 分鐘後再打下班卡。" };
    await sbPatch(`teacher_attendance?id=eq.${open[0].id}`, {
      check_out_at: now.toISOString(),
      check_out_source: "online",
      check_out_lat: gps?.lat ?? null,
      check_out_lng: gps?.lng ?? null,
      check_out_accuracy: gps?.acc ?? null,
      ...(optStr(fd, "note", 200) ? { note: optStr(fd, "note", 200) } : {}),
    });
    await audit(actorOf(staff), "punch.out", `teacher_attendance:${open[0].id}`, { gps: !!gps });
    revalidatePath("/admin");
    return { ok: `${hm} 下班打卡完成，辛苦了！` };
  }

  const location = str(fd, "location", 60);
  if (!location) return { error: "請填寫上班地點。" };
  const row = await sbInsert<{ id: string }>("teacher_attendance", {
    teacher_id: staff.id,
    check_in_at: now.toISOString(),
    source: "online",
    location,
    check_in_lat: gps?.lat ?? null,
    check_in_lng: gps?.lng ?? null,
    check_in_accuracy: gps?.acc ?? null,
    note: optStr(fd, "note", 200),
  });
  await audit(actorOf(staff), "punch.in", `teacher_attendance:${row.id}`, { location, gps: !!gps });
  revalidatePath("/admin");
  return { ok: `${hm} 上班打卡完成（${location}）` };
}

// 管理員補登或修改打卡（忘記打卡、打錯地點時使用）
export async function saveShift(fd: FormData) {
  const staff = await requireStaff(true);
  const id = str(fd, "id", 40);
  const teacherId = str(fd, "teacher_id", 40);
  const inAt = fromTaipeiLocal(str(fd, "check_in_at", 20));
  const outRaw = str(fd, "check_out_at", 20);
  const outAt = outRaw ? fromTaipeiLocal(outRaw) : null;
  if (!inAt) throw new Error("請填寫上班時間");
  if (outRaw && !outAt) throw new Error("下班時間格式不正確");
  if (outAt && outAt <= inAt) throw new Error("下班時間要晚於上班時間");
  const patch = {
    check_in_at: inAt.toISOString(),
    check_out_at: outAt ? outAt.toISOString() : null,
    location: optStr(fd, "location", 60),
    note: optStr(fd, "note", 200),
    edited_by: staff.id,
    edited_at: new Date().toISOString(),
  };
  if (isUuid(id)) {
    const before = await sbGet<object[]>(`teacher_attendance?id=eq.${id}&select=check_in_at,check_out_at,location,check_out_source`);
    const b = before[0] as { check_out_at: string | null; check_out_source: string | null } | undefined;
    await sbPatch(`teacher_attendance?id=eq.${id}`, {
      ...patch,
      ...(outAt && !b?.check_out_at ? { check_out_source: "manual" } : {}),
    });
    await audit(actorOf(staff), "shift.edit", `teacher_attendance:${id}`, { before: before[0], after: patch });
  } else {
    if (!isUuid(teacherId)) throw new Error("請選擇老師");
    const row = await sbInsert<{ id: string }>("teacher_attendance", {
      ...patch, teacher_id: teacherId, source: "manual", check_out_source: outAt ? "manual" : null,
    });
    await audit(actorOf(staff), "shift.add", `teacher_attendance:${row.id}`, { teacher: teacherId, ...patch });
  }
  revalidatePath("/admin/timesheet");
}

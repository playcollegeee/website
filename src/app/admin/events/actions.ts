"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbDelete, sbGet, sbInsert, sbPatch, sbRemoveFile, sbUpload } from "@/lib/supabase";
import { PHOTO_BUCKET } from "@/lib/sitePhotos";
import { str } from "@/lib/admin";
import { fromTaipeiLocal } from "@/lib/admin";
import {
  TEMPLATE_KEYS,
  type Booking,
  type NoticeKind,
  type Price,
  type Question,
  type Run,
  type Slot,
  type SlotTime,
  type Theme,
  type ThemePhoto,
} from "@/lib/eventTypes";

export type EvResult = { ok: boolean; message: string };
const OK = (message = "已儲存"): EvResult => ({ ok: true, message });
const NG = (message: string): EvResult => ({ ok: false, message });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "操作失敗");

const TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const MAX_BYTES = 4 * 1024 * 1024;

function refreshPublic(slug?: string) {
  revalidatePath("/workshops");
  revalidatePath("/workshops/all");
  if (slug) revalidatePath(`/workshops/${slug}`);
}

async function uploadImage(fd: FormData, folder: string): Promise<{ url: string; path: string; width: number; height: number } | null> {
  const file = fd.get("file");
  if (!(file instanceof Blob) || file.size === 0) return null;
  const ext = TYPES[file.type];
  if (!ext) throw new Error("只接受 JPG、PNG 或 WebP 圖片");
  if (file.size > MAX_BYTES) throw new Error("圖片太大（上限 4 MB）");
  const width = Math.min(Math.max(Number(fd.get("width")) || 1200, 50), 4000);
  const height = Math.min(Math.max(Number(fd.get("height")) || 900, 50), 4000);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const url = await sbUpload(PHOTO_BUCKET, path, file, file.type);
  return { url, path, width, height };
}

// ======================= 主題 =======================
export async function saveTheme(fd: FormData): Promise<EvResult> {
  const staff = await requireStaff(true);
  try {
    const id = str(fd, "id", 40);
    if (id && !isUuid(id)) return NG("資料不正確");
    const title = str(fd, "title", 60);
    if (!title) return NG("請填主題名稱");
    let slug = str(fd, "slug", 60).toLowerCase();
    if (!slug) slug = `w-${Math.random().toString(36).slice(2, 8)}`;
    if (!/^[a-z0-9-]{2,60}$/.test(slug)) return NG("網址代稱只能用英文小寫、數字和 -，例如 rc-car");
    const showcase = str(fd, "showcase", 10);
    if (!["none", "3d", "kids"].includes(showcase)) return NG("分類不正確");
    const activity_id = str(fd, "activity_id", 40);
    const fields = {
      title,
      slug,
      showcase,
      activity_id: isUuid(activity_id) ? activity_id : null,
      series: str(fd, "series", 40) || null,
      summary: str(fd, "summary", 800),
      highlights: str(fd, "highlights", 2000).split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10),
      audience_text: str(fd, "audience_text", 80) || null,
      duration_text: str(fd, "duration_text", 80) || null,
      includes_text: str(fd, "includes_text", 200) || null,
      notes_text: str(fd, "notes_text", 200) || null,
      published: fd.get("published") === "on",
    };
    const up = await uploadImage(fd, "themes");
    const cover = up ? { cover_url: up.url, cover_path: up.path } : {};
    const dup = await sbGet<{ id: string }[]>(`activity_themes?slug=eq.${slug}&select=id`);
    if (dup.some((d) => d.id !== id)) return NG("這個網址代稱已經有其他主題用了");
    if (id) {
      const old = (await sbGet<Theme[]>(`activity_themes?id=eq.${id}&select=*`))[0];
      if (!old) return NG("找不到這個主題");
      await sbPatch(`activity_themes?id=eq.${id}`, { ...fields, ...cover });
      if (up && old.cover_path) await sbRemoveFile(PHOTO_BUCKET, old.cover_path);
      await audit(actorOf(staff), "theme.update", `activity_themes:${id}`, { title });
      refreshPublic(slug);
      if (old.slug !== slug) refreshPublic(old.slug);
    } else {
      const last = await sbGet<{ sort: number }[]>("activity_themes?select=sort&order=sort.desc&limit=1");
      const row = await sbInsert<Theme>("activity_themes", { ...fields, ...cover, sort: (last[0]?.sort ?? 0) + 1, created_by: staff.id });
      await audit(actorOf(staff), "theme.create", `activity_themes:${row?.id}`, { title });
      refreshPublic(slug);
    }
    revalidatePath("/admin/events/themes");
    return OK(id ? "已儲存" : "已新增主題");
  } catch (e) {
    return NG(errMsg(e));
  }
}

export async function deleteTheme(id: string): Promise<EvResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id)) return NG("資料不正確");
  const runs = await sbGet<{ id: string }[]>(`activity_runs?theme_id=eq.${id}&select=id&limit=1`);
  if (runs.length) return NG("這個主題已經開過課，不能刪除；可以取消「顯示在官網」把它藏起來");
  const t = (await sbGet<Theme[]>(`activity_themes?id=eq.${id}&select=*`))[0];
  if (!t) return OK("已刪除");
  const photos = await sbGet<ThemePhoto[]>(`activity_theme_photos?theme_id=eq.${id}&select=*`);
  await sbDelete(`activity_themes?id=eq.${id}`);
  for (const p of photos) if (p.storage_path) await sbRemoveFile(PHOTO_BUCKET, p.storage_path);
  if (t.cover_path) await sbRemoveFile(PHOTO_BUCKET, t.cover_path);
  await audit(actorOf(staff), "theme.delete", `activity_themes:${id}`, { title: t.title });
  refreshPublic(t.slug);
  revalidatePath("/admin/events/themes");
  return OK("已刪除");
}

export async function addThemePhoto(fd: FormData): Promise<EvResult> {
  const staff = await requireStaff(true);
  try {
    const themeId = str(fd, "theme_id", 40);
    if (!isUuid(themeId)) return NG("資料不正確");
    const t = (await sbGet<Theme[]>(`activity_themes?id=eq.${themeId}&select=id,slug,cover_url`))[0];
    if (!t) return NG("找不到這個主題");
    const up = await uploadImage(fd, "themes");
    if (!up) return NG("請選照片");
    const last = await sbGet<{ sort: number }[]>(`activity_theme_photos?theme_id=eq.${themeId}&select=sort&order=sort.desc&limit=1`);
    await sbInsert("activity_theme_photos", { theme_id: themeId, url: up.url, storage_path: up.path, width: up.width, height: up.height, sort: (last[0]?.sort ?? 0) + 1 });
    if (!t.cover_url) await sbPatch(`activity_themes?id=eq.${themeId}`, { cover_url: up.url });
    await audit(actorOf(staff), "theme.photo.add", `activity_themes:${themeId}`);
    refreshPublic(t.slug);
    revalidatePath("/admin/events/themes");
    return OK("已上傳");
  } catch (e) {
    return NG(errMsg(e));
  }
}

export async function deleteThemePhoto(id: string): Promise<EvResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id)) return NG("資料不正確");
  const p = (await sbGet<ThemePhoto[]>(`activity_theme_photos?id=eq.${id}&select=*`))[0];
  if (!p) return OK("已刪除");
  await sbDelete(`activity_theme_photos?id=eq.${id}`);
  if (p.storage_path) await sbRemoveFile(PHOTO_BUCKET, p.storage_path);
  const t = (await sbGet<Theme[]>(`activity_themes?id=eq.${p.theme_id}&select=*`))[0];
  if (t && t.cover_url === p.url && !t.cover_path) {
    const next = (await sbGet<ThemePhoto[]>(`activity_theme_photos?theme_id=eq.${t.id}&select=url&order=sort&limit=1`))[0];
    await sbPatch(`activity_themes?id=eq.${t.id}`, { cover_url: next?.url ?? null });
  }
  await audit(actorOf(staff), "theme.photo.delete", `activity_themes:${p.theme_id}`);
  if (t) refreshPublic(t.slug);
  revalidatePath("/admin/events/themes");
  return OK("已刪除");
}

export async function moveThemePhoto(id: string, dir: "up" | "down"): Promise<EvResult> {
  await requireStaff(true);
  if (!isUuid(id)) return NG("資料不正確");
  const p = (await sbGet<ThemePhoto[]>(`activity_theme_photos?id=eq.${id}&select=*`))[0];
  if (!p) return NG("找不到照片");
  const list = await sbGet<ThemePhoto[]>(`activity_theme_photos?theme_id=eq.${p.theme_id}&select=id,sort&order=sort,created_at`);
  const i = list.findIndex((x) => x.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return OK("");
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((x, k) => (x.sort === k + 1 ? null : sbPatch(`activity_theme_photos?id=eq.${x.id}`, { sort: k + 1 }))));
  const t = (await sbGet<Theme[]>(`activity_themes?id=eq.${p.theme_id}&select=slug`))[0];
  if (t) refreshPublic(t.slug);
  revalidatePath("/admin/events/themes");
  return OK("");
}

export async function setThemeCover(photoId: string): Promise<EvResult> {
  const staff = await requireStaff(true);
  if (!isUuid(photoId)) return NG("資料不正確");
  const p = (await sbGet<ThemePhoto[]>(`activity_theme_photos?id=eq.${photoId}&select=*`))[0];
  if (!p) return NG("找不到照片");
  const t = (await sbGet<Theme[]>(`activity_themes?id=eq.${p.theme_id}&select=*`))[0];
  await sbPatch(`activity_themes?id=eq.${p.theme_id}`, { cover_url: p.url, cover_path: null });
  if (t?.cover_path) await sbRemoveFile(PHOTO_BUCKET, t.cover_path);
  await audit(actorOf(staff), "theme.cover", `activity_themes:${p.theme_id}`);
  if (t) refreshPublic(t.slug);
  revalidatePath("/admin/events/themes");
  return OK("已設為封面");
}

// ======================= 開課 =======================
// 新增開課：沿用同一主題上一次的價格、題目、退費辦法，改日期就好
export async function createRun(fd: FormData): Promise<void> {
  const staff = await requireStaff(true);
  const themeId = str(fd, "theme_id", 40);
  if (!isUuid(themeId)) redirect("/admin/events?err=請選擇主題");
  const prev = (await sbGet<Run[]>(`activity_runs?theme_id=eq.${themeId}&select=*&order=created_at.desc&limit=1`))[0];
  const theme = (await sbGet<Theme[]>(`activity_themes?id=eq.${themeId}&select=showcase`))[0];
  const row = await sbInsert<Run>("activity_runs", {
    theme_id: themeId,
    title: str(fd, "title", 80) || null,
    status: "draft",
    who: prev?.who ?? (theme?.showcase === "kids" ? "family" : "kids"),
    unit: prev?.unit ?? (theme?.showcase === "kids" ? "group" : "person"),
    pay_mode: prev?.pay_mode ?? "now",
    prices: prev?.prices ?? [{ key: "p1", label: "單人", amount: 0, seats: 1 }],
    questions: prev?.questions ?? [],
    refund_text: prev?.refund_text ?? null,
    reminder_days: prev?.reminder_days ?? 2,
    created_by: staff.id,
  });
  // 沿用上一次的場次地點（日期留空，等老師填）
  if (prev) {
    const slots = await sbGet<Slot[]>(`activity_slots?run_id=eq.${prev.id}&select=*&order=sort`);
    for (const s of slots) {
      await sbInsert("activity_slots", { run_id: row.id, label: s.label, area: s.area, venue: s.venue, address: s.address, capacity: s.capacity, min_seats: s.min_seats, waitlist: s.waitlist, sort: s.sort, times: [] });
    }
  }
  await audit(actorOf(staff), "run.create", `activity_runs:${row.id}`, { themeId, copiedFrom: prev?.id ?? null });
  redirect(`/admin/events/runs/${row.id}?edit=1`);
}

function parseJson<T>(v: string, fallback: T): T {
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

export async function saveRun(fd: FormData): Promise<EvResult> {
  const staff = await requireStaff(true);
  try {
    const id = str(fd, "id", 40);
    if (!isUuid(id)) return NG("資料不正確");
    const who = str(fd, "who", 10);
    const unit = str(fd, "unit", 10);
    const pay_mode = str(fd, "pay_mode", 20);
    if (!["kids", "family", "adult", "any"].includes(who)) return NG("參加方式不正確");
    if (!["person", "group"].includes(unit)) return NG("名額單位不正確");
    if (!["now", "after_confirm"].includes(pay_mode)) return NG("報名模式不正確");
    const rawPrices = parseJson<Price[]>(str(fd, "prices", 4000), []);
    const prices: Price[] = rawPrices
      .map((p, i) => ({
        key: /^[a-z0-9]{1,12}$/.test(String(p.key)) ? String(p.key) : `p${i + 1}`,
        label: String(p.label ?? "").trim().slice(0, 40),
        amount: Math.max(0, Math.round(Number(p.amount) || 0)),
        seats: Math.min(Math.max(Math.round(Number(p.seats) || 1), 1), 20),
        ...(p.returning_only ? { returning_only: true } : {}),
      }))
      .filter((p) => p.label);
    if (new Set(prices.map((p) => p.key)).size !== prices.length) return NG("方案代號重複了，請重新整理頁面再試");
    const rawQ = parseJson<Question[]>(str(fd, "questions", 4000), []);
    const questions: Question[] = rawQ
      .map((q, i) => ({
        key: /^[a-z0-9]{1,12}$/.test(String(q.key)) ? String(q.key) : `q${i + 1}`,
        label: String(q.label ?? "").trim().slice(0, 80),
        type: q.type === "choice" ? ("choice" as const) : ("text" as const),
        options: q.type === "choice" ? (q.options ?? []).map((o) => String(o).trim().slice(0, 40)).filter(Boolean).slice(0, 12) : undefined,
        required: !!q.required,
      }))
      .filter((q) => q.label);
    const deadline = str(fd, "deadline", 10);
    await sbPatch(`activity_runs?id=eq.${id}`, {
      title: str(fd, "title", 80) || null,
      intro: str(fd, "intro", 800) || null,
      who,
      unit,
      pay_mode,
      prices,
      questions,
      refund_text: str(fd, "refund_text", 3000) || null,
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : null,
      reminder_days: Math.min(Math.max(Number(fd.get("reminder_days")) || 2, 0), 14),
    });
    const up = await uploadImage(fd, "runs");
    if (up) {
      const old = (await sbGet<Run[]>(`activity_runs?id=eq.${id}&select=cover_path`))[0];
      await sbPatch(`activity_runs?id=eq.${id}`, { cover_url: up.url, cover_path: up.path });
      if (old?.cover_path) await sbRemoveFile(PHOTO_BUCKET, old.cover_path);
    }
    await audit(actorOf(staff), "run.update", `activity_runs:${id}`, { prices: prices.length, questions: questions.length });
    revalidatePath(`/admin/events/runs/${id}`);
    refreshPublic();
    return OK();
  } catch (e) {
    return NG(errMsg(e));
  }
}

export async function setRunStatus(id: string, status: Run["status"]): Promise<EvResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id) || !["draft", "open", "closed", "done"].includes(status)) return NG("資料不正確");
  if (status === "open") {
    const run = (await sbGet<Run[]>(`activity_runs?id=eq.${id}&select=*`))[0];
    const slots = await sbGet<Slot[]>(`activity_slots?run_id=eq.${id}&state=neq.cancelled&select=id,times`);
    if (!run?.prices?.length || run.prices.some((p) => p.amount <= 0)) return NG("請先設定報名方案與金額");
    if (slots.length === 0) return NG("請先新增至少一個場次");
    if (slots.some((s) => !s.times?.length)) return NG("有場次還沒填上課時間");
  }
  await sbPatch(`activity_runs?id=eq.${id}`, { status });
  await audit(actorOf(staff), "run.status", `activity_runs:${id}`, { status });
  revalidatePath(`/admin/events/runs/${id}`);
  revalidatePath("/admin/events");
  refreshPublic();
  return OK(status === "open" ? "已開放報名" : "已更新");
}

export async function deleteRun(id: string): Promise<EvResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id)) return NG("資料不正確");
  const b = await sbGet<{ id: string }[]>(`activity_bookings?run_id=eq.${id}&select=id&limit=1`);
  if (b.length) return NG("已經有人報名，不能刪除；可以改成「停止報名」或「已結束」");
  await sbDelete(`activity_runs?id=eq.${id}`);
  await audit(actorOf(staff), "run.delete", `activity_runs:${id}`);
  refreshPublic();
  redirect("/admin/events");
}

// ======================= 場次 =======================
export async function saveSlot(fd: FormData): Promise<EvResult> {
  const staff = await requireStaff(true);
  try {
    const id = str(fd, "id", 40);
    const runId = str(fd, "run_id", 40);
    if (!isUuid(runId) || (id && !isUuid(id))) return NG("資料不正確");
    const label = str(fd, "label", 40);
    if (!label) return NG("請填場次名稱，例如：台中場");
    const raw = parseJson<{ start: string; end: string }[]>(str(fd, "times", 4000), []);
    const times: SlotTime[] = [];
    for (const t of raw) {
      const s = fromTaipeiLocal(String(t.start ?? ""));
      const e = fromTaipeiLocal(String(t.end ?? ""));
      if (!s || !e) continue;
      if (e <= s) return NG("下課時間要晚於上課時間");
      times.push({ start: s.toISOString(), end: e.toISOString() });
    }
    times.sort((a, b) => a.start.localeCompare(b.start));
    const capacity = Math.min(Math.max(Number(fd.get("capacity")) || 6, 1), 500);
    const fields = {
      label,
      area: str(fd, "area", 10) || null,
      venue: str(fd, "venue", 80) || null,
      address: str(fd, "address", 120) || null,
      times,
      first_start: times[0]?.start ?? null,
      capacity,
      min_seats: Math.min(Math.max(Number(fd.get("min_seats")) || 0, 0), capacity),
      waitlist: fd.get("waitlist") === "on",
    };
    if (id) {
      await sbPatch(`activity_slots?id=eq.${id}&run_id=eq.${runId}`, fields);
    } else {
      const last = await sbGet<{ sort: number }[]>(`activity_slots?run_id=eq.${runId}&select=sort&order=sort.desc&limit=1`);
      await sbInsert("activity_slots", { ...fields, run_id: runId, sort: (last[0]?.sort ?? 0) + 1 });
    }
    await audit(actorOf(staff), id ? "slot.update" : "slot.create", `activity_runs:${runId}`, { label });
    revalidatePath(`/admin/events/runs/${runId}`);
    refreshPublic();
    return OK(id ? "已儲存場次" : "已新增場次");
  } catch (e) {
    return NG(errMsg(e));
  }
}

export async function deleteSlot(id: string): Promise<EvResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id)) return NG("資料不正確");
  const b = await sbGet<{ id: string }[]>(`activity_bookings?slot_id=eq.${id}&select=id&limit=1`);
  if (b.length) return NG("這個場次已經有人報名，不能刪除；可以改成停課");
  const s = (await sbGet<Slot[]>(`activity_slots?id=eq.${id}&select=run_id`))[0];
  await sbDelete(`activity_slots?id=eq.${id}`);
  await audit(actorOf(staff), "slot.delete", `activity_slots:${id}`);
  if (s) revalidatePath(`/admin/events/runs/${s.run_id}`);
  return OK("已刪除場次");
}

// 確定開課：先登記後匯款的報名改成「待匯款」，私訊清單會出現「請匯款」
export async function confirmSlot(id: string): Promise<EvResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id)) return NG("資料不正確");
  const s = (await sbGet<Slot[]>(`activity_slots?id=eq.${id}&select=*`))[0];
  if (!s) return NG("找不到場次");
  await sbPatch(`activity_slots?id=eq.${id}`, { state: "confirmed" });
  await sbPatch(`activity_bookings?slot_id=eq.${id}&status=eq.registered`, { status: "pending" });
  await audit(actorOf(staff), "slot.confirm", `activity_slots:${id}`);
  revalidatePath(`/admin/events/runs/${s.run_id}`);
  refreshPublic();
  return OK("已確定開課");
}

// 停課：所有報名改成取消，已繳費的預設全額退款（之後到報名列表標記「已退款」）
export async function cancelSlot(id: string, reason: string): Promise<EvResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id)) return NG("資料不正確");
  const s = (await sbGet<Slot[]>(`activity_slots?id=eq.${id}&select=*`))[0];
  if (!s) return NG("找不到場次");
  const why = reason.trim().slice(0, 100) || "未達開課人數";
  const list = await sbGet<Booking[]>(`activity_bookings?slot_id=eq.${id}&status=in.(registered,pending,paid,waitlist)&select=id,status,amount`);
  const now = new Date().toISOString();
  for (const b of list) {
    await sbPatch(`activity_bookings?id=eq.${b.id}`, {
      status: "cancelled",
      cancel_reason: why,
      cancelled_at: now,
      refund_amount: b.status === "paid" ? b.amount : null,
    });
  }
  await sbPatch(`activity_slots?id=eq.${id}`, { state: "cancelled" });
  await audit(actorOf(staff), "slot.cancel", `activity_slots:${id}`, { reason: why, bookings: list.length });
  revalidatePath(`/admin/events/runs/${s.run_id}`);
  refreshPublic();
  return OK(`已停課，${list.length} 筆報名改為取消，私訊清單會出現停課通知`);
}

export async function reopenSlot(id: string): Promise<EvResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id)) return NG("資料不正確");
  const s = (await sbGet<Slot[]>(`activity_slots?id=eq.${id}&select=*`))[0];
  if (!s) return NG("找不到場次");
  await sbPatch(`activity_slots?id=eq.${id}`, { state: "open" });
  await audit(actorOf(staff), "slot.reopen", `activity_slots:${id}`);
  revalidatePath(`/admin/events/runs/${s.run_id}`);
  refreshPublic();
  return OK("已改回招生中（已取消的報名不會自動恢復）");
}

// ======================= 報名 =======================
async function getBooking(id: string) {
  if (!isUuid(id)) return null;
  return (await sbGet<Booking[]>(`activity_bookings?id=eq.${id}&select=*`))[0] ?? null;
}
const refreshRun = (runId: string) => {
  revalidatePath(`/admin/events/runs/${runId}`);
  revalidatePath("/admin/events");
  revalidatePath("/admin/events/messages");
};

export async function markPaid(id: string): Promise<EvResult> {
  const staff = await requireStaff(true);
  const b = await getBooking(id);
  if (!b) return NG("找不到報名");
  if (!["pending", "registered"].includes(b.status)) return NG("這筆報名目前不是待匯款");
  await sbPatch(`activity_bookings?id=eq.${id}`, { status: "paid", paid_at: new Date().toISOString(), paid_by: staff.id });
  await audit(actorOf(staff), "booking.paid", `activity_bookings:${id}`, { code: b.code, amount: b.amount, last5: b.pay_last5 });
  refreshRun(b.run_id);
  return OK("已確認收款，私訊清單會出現「報名完成」");
}

export async function unmarkPaid(id: string): Promise<EvResult> {
  const staff = await requireStaff(true);
  const b = await getBooking(id);
  if (!b || b.status !== "paid") return NG("這筆報名不是已確認");
  await sbPatch(`activity_bookings?id=eq.${id}`, { status: "pending", paid_at: null, paid_by: null });
  await audit(actorOf(staff), "booking.unpaid", `activity_bookings:${id}`, { code: b.code });
  refreshRun(b.run_id);
  return OK("已改回待匯款");
}

export async function cancelBooking(id: string, refund: number | null, reason: string): Promise<EvResult> {
  const staff = await requireStaff(true);
  const b = await getBooking(id);
  if (!b) return NG("找不到報名");
  if (["cancelled", "refunded"].includes(b.status)) return NG("已經取消了");
  const amt = refund === null || Number.isNaN(refund) ? null : Math.min(Math.max(Math.round(refund), 0), b.amount);
  await sbPatch(`activity_bookings?id=eq.${id}`, {
    status: "cancelled",
    refund_amount: b.status === "paid" ? amt : null,
    cancel_reason: reason.trim().slice(0, 200) || null,
    cancelled_at: new Date().toISOString(),
  });
  await audit(actorOf(staff), "booking.cancel", `activity_bookings:${id}`, { code: b.code, refund: amt, reason });
  refreshRun(b.run_id);
  return OK("已取消報名，名額已釋出");
}

export async function markRefunded(id: string): Promise<EvResult> {
  const staff = await requireStaff(true);
  const b = await getBooking(id);
  if (!b || b.status !== "cancelled") return NG("只有已取消的報名可以標記退款");
  await sbPatch(`activity_bookings?id=eq.${id}`, { status: "refunded" });
  await audit(actorOf(staff), "booking.refunded", `activity_bookings:${id}`, { code: b.code, refund: b.refund_amount });
  refreshRun(b.run_id);
  return OK("已標記退款完成");
}

// 候補遞補：檢查名額後改成待匯款（或已登記）
export async function promoteWaitlist(id: string): Promise<EvResult> {
  const staff = await requireStaff(true);
  const b = await getBooking(id);
  if (!b || b.status !== "waitlist") return NG("這筆不是候補");
  const slot = (await sbGet<Slot[]>(`activity_slots?id=eq.${b.slot_id}&select=*`))[0];
  const run = (await sbGet<Run[]>(`activity_runs?id=eq.${b.run_id}&select=pay_mode`))[0];
  const used = (await sbGet<{ used: number }[]>(`activity_slot_usage?slot_id=eq.${b.slot_id}&select=used`))[0]?.used ?? 0;
  if (slot && used + b.seats > slot.capacity) return NG(`名額不足（剩 ${Math.max(0, slot.capacity - used)}），可以先調高場次名額`);
  const next = run?.pay_mode === "after_confirm" && slot?.state !== "confirmed" ? "registered" : "pending";
  await sbPatch(`activity_bookings?id=eq.${id}`, { status: next });
  await audit(actorOf(staff), "booking.promote", `activity_bookings:${id}`, { code: b.code });
  refreshRun(b.run_id);
  return OK("已遞補，記得私訊通知家長");
}

export async function saveBookingNote(id: string, note: string): Promise<EvResult> {
  const staff = await requireStaff(true);
  const b = await getBooking(id);
  if (!b) return NG("找不到報名");
  await sbPatch(`activity_bookings?id=eq.${id}`, { admin_note: note.trim().slice(0, 500) || null });
  await audit(actorOf(staff), "booking.note", `activity_bookings:${id}`);
  refreshRun(b.run_id);
  return OK("已儲存備註");
}

// 轉讓名額：只改參加者姓名（不退費、不重新報名）
export async function transferPeople(id: string, names: { id: string; name: string }[]): Promise<EvResult> {
  const staff = await requireStaff(true);
  const b = await getBooking(id);
  if (!b) return NG("找不到報名");
  for (const n of names) {
    if (!isUuid(n.id)) continue;
    const name = n.name.trim().slice(0, 40);
    if (!name) return NG("參加者姓名不可空白");
    await sbPatch(`activity_booking_people?id=eq.${n.id}&booking_id=eq.${id}`, { name, person_id: null });
  }
  await audit(actorOf(staff), "booking.transfer", `activity_bookings:${id}`, { code: b.code });
  refreshRun(b.run_id);
  return OK("已更新參加者");
}

// 私訊或 Email 已送出（從私訊清單或報名列表按）
export async function logNotice(bookingId: string, kind: NoticeKind, channel: "dm" | "email" = "dm"): Promise<EvResult> {
  const staff = await requireStaff(true);
  const b = await getBooking(bookingId);
  if (!b) return NG("找不到報名");
  await sbInsert("activity_notices", { booking_id: bookingId, kind, channel, sent_by: staff.id });
  await audit(actorOf(staff), "booking.notice", `activity_bookings:${bookingId}`, { kind, channel });
  refreshRun(b.run_id);
  return OK("已記錄");
}

// ======================= 設定、湊班 =======================
export async function saveSettings(fd: FormData): Promise<EvResult> {
  const staff = await requireStaff(true);
  try {
    const keys = ["bank", "refund", "team", ...TEMPLATE_KEYS.map((t) => t.key)];
    for (const k of keys) {
      const v = fd.get(k);
      if (typeof v !== "string") continue;
      await sbInsert("activity_settings", { key: k, value: v.slice(0, 4000), updated_at: new Date().toISOString() }, "key");
    }
    await audit(actorOf(staff), "activity.settings", "activity_settings");
    revalidatePath("/admin/events/settings");
    return OK();
  } catch (e) {
    return NG(errMsg(e));
  }
}

export async function setInterestStatus(id: string, status: "new" | "notified" | "closed"): Promise<EvResult> {
  const staff = await requireStaff(true);
  if (!isUuid(id) || !["new", "notified", "closed"].includes(status)) return NG("資料不正確");
  await sbPatch(`activity_interests?id=eq.${id}`, { status });
  await audit(actorOf(staff), "interest.status", `activity_interests:${id}`, { status });
  revalidatePath("/admin/events/interests");
  return OK("已更新");
}

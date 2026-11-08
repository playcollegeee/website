// 後台活動報名：讀取資料、整理「要傳的私訊」清單（只在伺服器使用）
import { sbGet } from "@/lib/supabase";
import {
  bookingLink,
  buildMessage,
  getSettings,
  slotsWithUsage,
  type Booking,
  type BookingPerson,
  type Notice,
  type NoticeKind,
  type Run,
  type SlotWithUsage,
  type Theme,
} from "@/lib/events";

export type FullBooking = Booking & { token: string; people: BookingPerson[]; notices: Notice[] };
export type RunDetail = { run: Run; theme: Theme; slots: SlotWithUsage[]; bookings: FullBooking[] };

export async function loadBookings(filter: string): Promise<FullBooking[]> {
  const bookings = await sbGet<(Booking & { token: string })[]>(`activity_bookings?${filter}&select=*&order=created_at`);
  if (bookings.length === 0) return [];
  const ids = bookings.map((b) => b.id).join(",");
  const [people, notices] = await Promise.all([
    sbGet<BookingPerson[]>(`activity_booking_people?booking_id=in.(${ids})&select=*&order=sort`),
    sbGet<Notice[]>(`activity_notices?booking_id=in.(${ids})&select=*&order=sent_at`),
  ]);
  return bookings.map((b) => ({ ...b, people: people.filter((p) => p.booking_id === b.id), notices: notices.filter((n) => n.booking_id === b.id) }));
}

export async function loadRunDetail(runId: string): Promise<RunDetail | null> {
  const run = (await sbGet<Run[]>(`activity_runs?id=eq.${runId}&select=*`))[0];
  if (!run) return null;
  const theme = (await sbGet<Theme[]>(`activity_themes?id=eq.${run.theme_id}&select=*`))[0];
  const [slots, bookings] = await Promise.all([slotsWithUsage([run.id]), loadBookings(`run_id=eq.${run.id}`)]);
  return { run, theme, slots, bookings };
}

export type QueueItem = {
  booking: FullBooking;
  kind: NoticeKind;
  title: string;
  text: string;
  runTitle: string;
  slotLabel: string;
  runId: string;
};

const has = (b: FullBooking, k: NoticeKind) => b.notices.some((n) => n.kind === k && n.channel === "dm");

// 依報名狀態算出「還沒傳的私訊」：收到報名 → 確定開課請匯款 → 報名完成 → 課前提醒；停課／取消
export function buildQueue(details: RunDetail[], settings: Record<string, string>, now = new Date()): QueueItem[] {
  const out: QueueItem[] = [];
  for (const d of details) {
    if (d.run.status === "draft") continue;
    for (const b of d.bookings) {
      const slot = d.slots.find((s) => s.id === b.slot_id) ?? null;
      const ctx = { booking: b, people: b.people, run: d.run, theme: d.theme, slot, link: bookingLink(b.code, b.token) };
      const push = (kind: NoticeKind, tpl: string, title: string, extra: Partial<typeof ctx> & { reason?: string; refund?: string } = {}) =>
        out.push({
          booking: b,
          kind,
          title,
          text: buildMessage(tpl, settings, { ...ctx, ...extra }),
          runTitle: d.run.title?.trim() || d.theme.title,
          slotLabel: slot?.label ?? "",
          runId: d.run.id,
        });
      const started = slot?.first_start ? new Date(slot.first_start) <= now : false;
      if (["registered", "pending", "waitlist"].includes(b.status) && !has(b, "registered") && !started) {
        push("registered", "dm_registered", b.status === "waitlist" ? "收到報名（候補）" : "收到報名");
      }
      if (b.status === "pending" && d.run.pay_mode === "after_confirm" && slot?.state === "confirmed" && !has(b, "pay")) {
        push("pay", "dm_pay", "確定開課・請匯款");
      }
      if (b.status === "paid" && !has(b, "paid") && !started) push("paid", "dm_paid", "報名完成");
      if (b.status === "paid" && slot?.first_start && !has(b, "reminder")) {
        const ms = new Date(slot.first_start).getTime() - now.getTime();
        if (ms > 0 && ms <= (d.run.reminder_days || 2) * 86400_000 + 12 * 3600_000) push("reminder", "dm_reminder", "課前提醒");
      }
      if (["cancelled", "refunded"].includes(b.status) && !has(b, "cancelled") && slot?.state === "cancelled") {
        push("cancelled", "dm_cancelled", "停課通知", {
          reason: b.cancel_reason ?? undefined,
          refund: b.refund_amount ? `我們會退還 ${b.refund_amount.toLocaleString("en-US")} 元，請私訊提供退款帳號。` : "",
        });
      }
    }
  }
  return out;
}

// 所有非草稿、未結束太久的開課（給私訊清單用）
export async function loadActiveDetails(): Promise<RunDetail[]> {
  const runs = await sbGet<Run[]>("activity_runs?status=in.(open,closed)&select=id&order=created_at.desc");
  const out: RunDetail[] = [];
  for (const r of runs) {
    const d = await loadRunDetail(r.id);
    if (d) out.push(d);
  }
  return out;
}

export async function loadQueue() {
  const [details, settings] = await Promise.all([loadActiveDetails(), getSettings()]);
  return { queue: buildQueue(details, settings), details, settings };
}

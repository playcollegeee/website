// 活動報名：伺服器端讀取資料（官網與後台共用）。只能在伺服器使用。
import { sbGet } from "./supabase";
import {
  ACTIVE_STATUSES,
  fillTemplate,
  fmtTimes,
  money,
  runTitle,
  type Booking,
  type BookingPerson,
  type Run,
  type Slot,
  type SlotUsage,
  type Theme,
  type ThemePhoto,
} from "./eventTypes";
export * from "./eventTypes";

export type SlotWithUsage = Slot & { used: number; paid: number; waiting: number; left: number };
export type RunBundle = { run: Run; theme: Theme; slots: SlotWithUsage[] };

// 設定（匯款資訊、退費辦法、私訊範本…）
export async function getSettings(): Promise<Record<string, string>> {
  const rows = await sbGet<{ key: string; value: string }[]>("activity_settings?select=key,value").catch(() => []);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function slotsWithUsage(runIds: string[]): Promise<SlotWithUsage[]> {
  if (runIds.length === 0) return [];
  const slots = await sbGet<Slot[]>(`activity_slots?run_id=in.(${runIds.join(",")})&select=*&order=sort,first_start`);
  if (slots.length === 0) return [];
  const usage = await sbGet<SlotUsage[]>(`activity_slot_usage?slot_id=in.(${slots.map((s) => s.id).join(",")})&select=*`);
  const u = new Map(usage.map((x) => [x.slot_id, x]));
  return slots.map((s) => {
    const x = u.get(s.id) ?? { used: 0, paid: 0, waiting: 0 };
    return { ...s, used: x.used, paid: x.paid, waiting: x.waiting, left: Math.max(0, s.capacity - x.used) };
  });
}

// 官網：工作坊總覽（只列出有分類、顯示中的主題）
export async function getShowcaseThemes(): Promise<{ themes: Theme[]; openRunThemeIds: Set<string> }> {
  const themes = await sbGet<Theme[]>("activity_themes?published=eq.true&showcase=neq.none&select=*&order=sort,created_at").catch(() => []);
  const runs = await sbGet<{ theme_id: string }[]>("activity_runs?status=eq.open&select=theme_id").catch(() => []);
  return { themes, openRunThemeIds: new Set(runs.map((r) => r.theme_id)) };
}

// 官網：正在報名的活動（每一個開課＋場次）
export async function getOpenRuns(): Promise<RunBundle[]> {
  const runs = await sbGet<Run[]>("activity_runs?status=eq.open&select=*&order=created_at.desc").catch(() => []);
  if (runs.length === 0) return [];
  const themes = await sbGet<Theme[]>(`activity_themes?id=in.(${[...new Set(runs.map((r) => r.theme_id))].join(",")})&select=*`);
  const slots = await slotsWithUsage(runs.map((r) => r.id));
  const tm = new Map(themes.map((t) => [t.id, t]));
  return runs
    .filter((r) => tm.has(r.theme_id))
    .map((run) => ({ run, theme: tm.get(run.theme_id)!, slots: slots.filter((s) => s.run_id === run.id && s.state !== "cancelled") }))
    .sort((a, b) => (a.slots[0]?.first_start ?? "9").localeCompare(b.slots[0]?.first_start ?? "9"));
}

export async function getThemeBySlug(slug: string): Promise<{ theme: Theme; photos: ThemePhoto[]; runs: RunBundle[] } | null> {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  const theme = (await sbGet<Theme[]>(`activity_themes?slug=eq.${slug}&published=eq.true&select=*`).catch(() => []))[0];
  if (!theme) return null;
  const photos = await sbGet<ThemePhoto[]>(`activity_theme_photos?theme_id=eq.${theme.id}&select=*&order=sort,created_at`).catch(() => []);
  const runs = await sbGet<Run[]>(`activity_runs?theme_id=eq.${theme.id}&status=eq.open&select=*&order=created_at.desc`).catch(() => []);
  const slots = await slotsWithUsage(runs.map((r) => r.id)).catch(() => []);
  return {
    theme,
    photos,
    runs: runs.map((run) => ({ run, theme, slots: slots.filter((s) => s.run_id === run.id && s.state !== "cancelled") })),
  };
}

export async function getRunBundle(runId: string): Promise<RunBundle | null> {
  const run = (await sbGet<Run[]>(`activity_runs?id=eq.${runId}&select=*`).catch(() => []))[0];
  if (!run) return null;
  const theme = (await sbGet<Theme[]>(`activity_themes?id=eq.${run.theme_id}&select=*`))[0];
  if (!theme) return null;
  return { run, theme, slots: await slotsWithUsage([run.id]) };
}

// 家長的報名查詢頁：用報名編號＋連結金鑰找報名
export async function getBookingByToken(code: string, token: string) {
  if (!/^[A-Z0-9]{6}$/.test(code) || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const b = (await sbGet<(Booking & { token: string })[]>(`activity_bookings?code=eq.${code}&select=*`).catch(() => []))[0];
  if (!b || !safeEqual(b.token, token)) return null;
  const bundle = await getRunBundle(b.run_id);
  if (!bundle) return null;
  const people = await sbGet<BookingPerson[]>(`activity_booking_people?booking_id=eq.${b.id}&select=*&order=sort`);
  const slot = bundle.slots.find((s) => s.id === b.slot_id) ?? null;
  return { booking: b as Booking, people, ...bundle, slot };
}

// 比對金鑰（固定時間比較，避免被逐字猜測）
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// 報名編號：6 碼，去掉容易看錯的 0 O 1 I L
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newCode(): string {
  const a = crypto.getRandomValues(new Uint8Array(6));
  return [...a].map((x) => CODE_CHARS[x % CODE_CHARS.length]).join("");
}
export function newToken(): string {
  const a = crypto.getRandomValues(new Uint8Array(18));
  return Buffer.from(a).toString("base64url");
}

export function siteUrl(): string {
  return (process.env.SITE_URL || "https://playcollegeee.com").replace(/\/+$/, "");
}
export const bookingLink = (code: string, token: string) => `${siteUrl()}/signup/done/${code}?t=${token}`;

// 是否可以付款（顯示匯款資訊）：先登記後匯款的活動要等場次確定開課
export function canPay(b: Pick<Booking, "status">, run: Pick<Run, "pay_mode">, slot: Pick<Slot, "state"> | null): boolean {
  if (b.status !== "pending") return false;
  return run.pay_mode === "now" || slot?.state === "confirmed";
}

// 產生私訊稿
export function buildMessage(
  tplKey: string,
  settings: Record<string, string>,
  ctx: { booking: Booking; people: { name: string }[]; run: Run; theme: Theme; slot: Slot | null; link?: string; reason?: string; refund?: string },
): string {
  const { booking: b, run, theme, slot } = ctx;
  const payable = b.status === "pending" && (run.pay_mode === "now" || slot?.state === "confirmed");
  const vars: Record<string, string> = {
    家長: b.contact_name,
    參加者: ctx.people.map((p) => p.name).join("、"),
    活動: runTitle(run, theme),
    場次: slot ? `（${slot.label}）` : "",
    時間: slot ? fmtTimes(slot.times) : "",
    地點: slot ? [slot.venue, slot.address].filter(Boolean).join("，") : "",
    金額: money(b.amount),
    編號: b.code,
    匯款資訊: settings.bank?.trim() ?? "",
    付款說明:
      b.status === "waitlist"
        ? "目前名額已滿，已幫您登記候補，有名額會第一時間通知您。"
        : b.status === "registered"
          ? "確定開課後我們會再通知您匯款資訊，目前不用先匯款喔。"
          : payable
            ? `應繳金額：${money(b.amount)} 元\n${settings.bank?.trim() ?? ""}\n匯款後請到這裡填帳號末五碼：${ctx.link ?? ""}`
            : "",
    連結: ctx.link ?? "",
    備註: theme.notes_text ?? "",
    原因: ctx.reason ?? "未達開課人數",
    退款說明: ctx.refund ?? "",
  };
  return fillTemplate(settings[tplKey] ?? "", vars);
}

export { ACTIVE_STATUSES };

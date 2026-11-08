// 活動報名：型別、顯示文字與小工具（瀏覽器與伺服器都能用，不可引用 supabase）
// 資料表見 supabase/migrations/0016_activity_signup.sql

export type Showcase = "none" | "3d" | "kids";
export type Who = "kids" | "family" | "adult" | "any";
export type Unit = "person" | "group";
export type PayMode = "now" | "after_confirm";
export type RunStatus = "draft" | "open" | "closed" | "done";
export type SlotState = "open" | "confirmed" | "cancelled";
export type BookingStatus = "registered" | "pending" | "paid" | "waitlist" | "cancelled" | "refunded";
export type PersonKind = "child" | "adult";

export type Theme = {
  id: string;
  activity_id: string | null;
  title: string;
  slug: string;
  showcase: Showcase;
  series: string | null;
  summary: string;
  highlights: string[];
  audience_text: string | null;
  duration_text: string | null;
  includes_text: string | null;
  notes_text: string | null;
  cover_url: string | null;
  cover_path: string | null;
  sort: number;
  published: boolean;
};

export type ThemePhoto = { id: string; theme_id: string; url: string; storage_path: string | null; width: number; height: number; sort: number };

export type Price = { key: string; label: string; amount: number; seats: number; returning_only?: boolean };
export type Question = { key: string; label: string; type: "text" | "choice"; options?: string[]; required?: boolean };

export type Run = {
  id: string;
  theme_id: string;
  title: string | null;
  intro: string | null;
  status: RunStatus;
  who: Who;
  unit: Unit;
  pay_mode: PayMode;
  prices: Price[];
  questions: Question[];
  refund_text: string | null;
  deadline: string | null;
  reminder_days: number;
  cover_url: string | null;
  cover_path: string | null;
  created_at: string;
};

export type SlotTime = { start: string; end: string };
export type Slot = {
  id: string;
  run_id: string;
  label: string;
  area: string | null;
  venue: string | null;
  address: string | null;
  times: SlotTime[];
  first_start: string | null;
  capacity: number;
  min_seats: number;
  state: SlotState;
  waitlist: boolean;
  sort: number;
};
export type SlotUsage = { slot_id: string; used: number; paid: number; waiting: number };

export type Booking = {
  id: string;
  code: string;
  token?: string; // 家長查詢連結的金鑰：只在後台伺服器端使用，不可傳到官網頁面
  run_id: string;
  slot_id: string;
  family_id: string | null;
  status: BookingStatus;
  price_key: string;
  price_label: string;
  qty: number;
  seats: number;
  amount: number;
  claims_returning: boolean;
  is_returning: boolean;
  contact_name: string;
  phone: string;
  email: string | null;
  social_name: string | null;
  pay_last5: string | null;
  pay_reported_at: string | null;
  paid_at: string | null;
  refund_amount: number | null;
  cancel_reason: string | null;
  answers: Record<string, string>;
  message: string | null;
  admin_note: string | null;
  photo_ok: boolean;
  marketing: boolean;
  created_at: string;
};
export type BookingPerson = {
  id: string;
  booking_id: string;
  person_id: string | null;
  kind: PersonKind;
  name: string;
  grade: number | null;
  care_notes: string | null;
  sort: number;
};
export type Notice = { id: string; booking_id: string; kind: NoticeKind; channel: "dm" | "email"; sent_at: string };
export type NoticeKind = "registered" | "pay" | "paid" | "reminder" | "cancelled" | "waitlist_open" | "custom";

export type Family = {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  social_name: string | null;
  marketing: boolean;
  marketing_at: string | null;
  photo_ok: boolean | null;
  note: string | null;
  first_seen: string;
  last_seen: string;
};
export type Person = { id: string; family_id: string; kind: PersonKind; name: string; grade: number | null; grade_year: number | null; note: string | null };
export type ContactTag = { id: string; name: string; color: "gray" | "yellow" | "green" | "red" | "blue" };
export type Interest = {
  id: string;
  theme_id: string;
  contact_name: string;
  phone: string;
  email: string | null;
  social_name: string | null;
  headcount: number;
  who_text: string | null;
  prefer_text: string | null;
  status: "new" | "notified" | "closed";
  created_at: string;
};

// ---------- 顯示文字 ----------
export const SHOWCASE_LABEL: Record<Showcase, string> = { none: "不列在工作坊總覽", "3d": "3D 造物工作坊", kids: "幼兒主題活動" };
export const SHOWCASE_LEAD: Record<"3d" | "kids", string> = {
  "3d": "國小三年級以上。從設計、3D 列印到組裝，用幾週時間完成一件真正會動、能用的作品。",
  kids: "3–7 歲親子。從繪本和角色扮演出發，和爸爸媽媽一起動手做，作品直接帶回家。",
};
export const WHO_LABEL: Record<Who, string> = { kids: "孩子參加", family: "親子一起（記錄孩子）", adult: "大人自己參加", any: "大人小孩都可以" };
export const UNIT_LABEL: Record<Unit, string> = { person: "人", group: "組" };
export const PAY_MODE_LABEL: Record<PayMode, string> = { now: "填單後就匯款", after_confirm: "確定開課後才匯款" };
export const RUN_STATUS_LABEL: Record<RunStatus, string> = { draft: "草稿", open: "報名中", closed: "停止報名", done: "已結束" };
export const SLOT_STATE_LABEL: Record<SlotState, string> = { open: "招生中", confirmed: "確定開課", cancelled: "停課" };
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  registered: "已登記（待開課確認）",
  pending: "待匯款／待對帳",
  paid: "報名完成",
  waitlist: "候補",
  cancelled: "已取消",
  refunded: "已退款",
};
export const BOOKING_STATUS_COLOR: Record<BookingStatus, string> = {
  registered: "blue",
  pending: "yellow",
  paid: "green",
  waitlist: "gray",
  cancelled: "red",
  refunded: "red",
};
export const NOTICE_LABEL: Record<NoticeKind, string> = {
  registered: "收到報名",
  pay: "確定開課・請匯款",
  paid: "報名完成",
  reminder: "課前提醒",
  cancelled: "停課／取消",
  waitlist_open: "候補遞補",
  custom: "其他",
};
export const ACTIVE_STATUSES: BookingStatus[] = ["registered", "pending", "paid"];
export const AREAS = ["台中", "新竹", "彰化"];

// ---------- 年級與階段 ----------
export const GRADES: { value: number; label: string }[] = [
  { value: -3, label: "幼幼班" },
  { value: -2, label: "小班" },
  { value: -1, label: "中班" },
  { value: 0, label: "大班" },
  ...[1, 2, 3, 4, 5, 6].map((g) => ({ value: g, label: `小${"一二三四五六"[g - 1]}` })),
  ...[7, 8, 9].map((g) => ({ value: g, label: `國${"一二三"[g - 7]}` })),
  ...[10, 11, 12].map((g) => ({ value: g, label: `高${"一二三"[g - 10]}` })),
];
export function gradeLabel(g: number | null | undefined): string {
  if (g === null || g === undefined) return "";
  if (g > 12) return "高中畢業以上";
  if (g < -3) return "幼幼班以下";
  return GRADES.find((x) => x.value === g)?.label ?? "";
}

// 學年度：8 月起算新學年（與資料庫 school_year() 相同）
export function schoolYear(d: Date = new Date()): number {
  const tw = new Date(d.getTime() + 8 * 3600_000);
  return tw.getUTCFullYear() - (tw.getUTCMonth() < 7 ? 1 : 0);
}
// 依記錄當年的年級推算現在的年級
export function currentGrade(p: { grade: number | null; grade_year: number | null }, now = new Date()): number | null {
  if (p.grade === null || p.grade === undefined) return null;
  return p.grade + (p.grade_year ? schoolYear(now) - p.grade_year : 0);
}
// 五階段（與 content.ts 的 levels 一致）
export const STAGES = [
  { slug: "wanbao", name: "玩寶", min: -9, max: 0 },
  { slug: "wantong", name: "玩童", min: 1, max: 2 },
  { slug: "wanle", name: "玩樂", min: 3, max: 5 },
  { slug: "wanchuang", name: "玩創", min: 6, max: 8 },
  { slug: "wanjia", name: "玩家", min: 9, max: 99 },
] as const;
export function stageOf(grade: number | null): string | null {
  if (grade === null) return null;
  return STAGES.find((s) => grade >= s.min && grade <= s.max)?.name ?? null;
}

// ---------- 時間顯示（台灣時間） ----------
const TZ = "Asia/Taipei";
const dayFmt = new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, month: "numeric", day: "numeric", weekday: "short" });
const hmFmt = new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

// 同一天的多段時間合併：3/7（六）09:30–12:00、13:30–16:00
export function fmtTimes(times: SlotTime[]): string {
  const byDay = new Map<string, string[]>();
  for (const t of [...times].sort((a, b) => a.start.localeCompare(b.start))) {
    const s = new Date(t.start);
    const e = new Date(t.end);
    if (Number.isNaN(s.getTime())) continue;
    const day = dayFmt.format(s).replace("週", ""); // 3/7（日）
    const seg = `${hmFmt.format(s)}–${Number.isNaN(e.getTime()) ? "" : hmFmt.format(e)}`;
    byDay.set(day, [...(byDay.get(day) ?? []), seg]);
  }
  return [...byDay.entries()].map(([d, segs]) => `${d} ${segs.join("、")}`).join("；");
}
export const ymdTW = (d: Date | string) => ymdFmt.format(new Date(d));
// 給 <input type="datetime-local"> 用的台灣時間字串
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 16);
}

// ---------- 價格與退費 ----------
export const money = (n: number) => `${n.toLocaleString("en-US")}`;

// 依目前的退費辦法建議退款金額（老師可以改）：30 天前 50%、10–29 天 30%、10 天內不退
export function suggestRefund(amount: number, firstStart: string | null, now = new Date()): { amount: number; rule: string } {
  if (!firstStart) return { amount: 0, rule: "沒有上課日期，請自行填寫" };
  const days = Math.floor((new Date(firstStart).getTime() - now.getTime()) / 86400_000);
  if (days >= 30) return { amount: Math.round(amount * 0.5), rule: `距離開課 ${days} 天（30 天前）：退 50%` };
  if (days >= 10) return { amount: Math.round(amount * 0.3), rule: `距離開課 ${days} 天（10–30 天）：退 30%` };
  return { amount: 0, rule: `距離開課 ${Math.max(days, 0)} 天（10 天內）：不退款；病假、颱風、主辦取消另計` };
}

// 私訊與 Email 範本：把 {家長}、{活動}… 換成實際內容；空白的變數整行拿掉
export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl
    .split("\n")
    .map((line) => {
      let empty = false;
      const out = line.replace(/\{([^{}]+)\}/g, (_, k: string) => {
        const v = vars[k];
        if (v === undefined || v === "") {
          empty = true;
          return "";
        }
        return v;
      });
      // 這一行只有空變數（例如 {備註} 沒有內容）就整行拿掉
      return empty && out.replace(/[\s：:]/g, "") === "" ? null : out;
    })
    .filter((l): l is string => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export const TEMPLATE_KEYS: { key: string; label: string; kind: NoticeKind }[] = [
  { key: "dm_registered", label: "收到報名", kind: "registered" },
  { key: "dm_pay", label: "確定開課・請匯款（先登記後匯款的活動）", kind: "pay" },
  { key: "dm_paid", label: "報名完成（已收到款項）", kind: "paid" },
  { key: "dm_reminder", label: "課前提醒", kind: "reminder" },
  { key: "dm_cancelled", label: "停課通知", kind: "cancelled" },
  { key: "dm_waitlist_open", label: "候補遞補", kind: "waitlist_open" },
];
export const TEMPLATE_VARS = "{家長} {參加者} {活動} {場次} {時間} {地點} {金額} {編號} {匯款資訊} {付款說明} {連結} {備註} {原因} {退款說明}";

export const runTitle = (run: Pick<Run, "title">, theme: Pick<Theme, "title">) => run.title?.trim() || theme.title;

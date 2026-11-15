// 冬夏令營頁面：型別、預設內容與小工具（瀏覽器與伺服器都能用，不可引用 supabase）
// 資料表見 supabase/migrations/0022_camps.sql
// 2026-11-15 使用者決定：以梯次報名、一律全天；營隊頁不顯示價格；選單依日期自動出現、也可手動；有早鳥優惠

export const CAMP_TAG = "camps"; // 官網快取標籤（頂端選單）

export type SeasonKind = "winter" | "summer";
export type MenuMode = "auto" | "on" | "off";
export type CampMajor = "lego" | "3d" | "art" | "mix";

export type FlowStep = { time: string; title: string; note?: string };
export type FaqItem = { cat: string; q: string; a: string };
export type CampPhoto = { url: string; path?: string | null; width: number; height: number };

export type CampSeason = {
  id: string;
  season: SeasonKind;
  year: number;
  slug: string;
  title: string;
  headline: string;
  intro: string;
  cover_url: string | null;
  cover_path: string | null;
  status: "draft" | "published";
  menu_mode: MenuMode;
  promo_from: string | null;
  early_until: string | null;
  early_text: string | null;
  day_flow: FlowStep[];
  faq: FaqItem[];
  bring: string;
  pickup: string;
  photos: CampPhoto[];
  updated_at?: string;
};

export type CampProgram = {
  id: string;
  season_id: string;
  plan_id: string | null;
  run_id: string | null;
  title: string;
  tagline: string;
  major: CampMajor;
  stages: string[];
  grade_text: string | null;
  highlights: string[];
  takeaway: string | null;
  show_schedule: boolean;
  day_overrides: Record<string, string>;
  cover_url: string | null;
  cover_path: string | null;
  sort: number;
  published: boolean;
};

// 官網用：一個營隊整理好要顯示的內容（不含價格）
export type SeatState = "soon" | "open" | "few" | "full" | "waitlist" | "closed";
export type CampDay = { day: string; am: string; pm: string };
export type CampCard = {
  id: string;
  title: string;
  tagline: string;
  major: CampMajor;
  stages: string[];
  grade_text: string | null;
  highlights: string[];
  takeaway: string | null;
  cover_url: string | null;
  color: Brand;
  days: string[]; // 上課日 YYYY-MM-DD
  schedule: CampDay[]; // 每天上午／下午（show_schedule 關掉就是空的）
  time_text: string; // 例：每天 9:30–16:00
  venue: string | null;
  seat: SeatState;
  left: number | null;
  signup_href: string | null; // 報名頁；還沒開放就是 null
  notify_href: string; // 「開放時通知我」
  deadline: string | null;
};

export type Brand = "yellow" | "green" | "red" | "blue";
export const BRAND_CYCLE: Brand[] = ["blue", "red", "green", "yellow"];

export const SEASON_LABEL: Record<SeasonKind, string> = { winter: "冬令營", summer: "夏令營" };
export const SEASON_ICON: Record<SeasonKind, string> = { winter: "❄️", summer: "☀️" };

export const MAJOR_INFO: Record<CampMajor, { label: string; short: string; color: Brand }> = {
  lego: { label: "LEGO 樂高建構與機器人", short: "LEGO", color: "red" },
  "3d": { label: "3D 列印與造物", short: "3D 造物", color: "blue" },
  art: { label: "美術與視覺創作", short: "美術", color: "green" },
  mix: { label: "跨域主題", short: "跨域", color: "yellow" },
};

// 五階段（與 content.ts 的 levels 一致，不可自行更改）
export const CAMP_STAGES = [
  { slug: "wanbao", name: "玩寶", grades: "幼幼～大班" },
  { slug: "wantong", name: "玩童", grades: "小一～小二" },
  { slug: "wanle", name: "玩樂", grades: "小三～小五" },
  { slug: "wanchuang", name: "玩創", grades: "小六～國二" },
  { slug: "wanjia", name: "玩家", grades: "國三以上" },
] as const;
export const STAGE_NAME: Record<string, string> = Object.fromEntries(CAMP_STAGES.map((s) => [s.slug, s.name]));

export const MENU_MODE_LABEL: Record<MenuMode, string> = {
  auto: "依日期自動（從「開始宣傳」那天出現，最後一梯結束後自動收起）",
  on: "一直顯示",
  off: "不顯示",
};

// 預設一天的流程（營隊時段與課程規劃的 CAMP_SLOTS 一致：上午 9:30–12:00、下午 13:30–16:00）
export const DEFAULT_DAY_FLOW: FlowStep[] = [
  { time: "09:15", title: "報到", note: "老師在門口迎接，放好書包、換室內鞋" },
  { time: "09:30", title: "上午課程", note: "今天的任務說明、動手做" },
  { time: "12:00", title: "午餐與休息", note: "老師陪同用餐、午休" },
  { time: "13:30", title: "下午課程", note: "延續上午的作品，測試、改良" },
  { time: "15:40", title: "作品分享", note: "上台介紹今天的成果、整理教室" },
  { time: "16:00", title: "接回家", note: "家長到教室接孩子" },
];

// 預設 Q&A：含【待填】的題目在官網不會出現，老師填好才顯示
export const DEFAULT_FAQ: FaqItem[] = [
  { cat: "報名", q: "每一梯要分開報名嗎？可以只報上午或下午嗎？", a: "每一梯都是獨立的營隊，請分別報名。營隊一律全天參加，不分上午、下午報名。" },
  { cat: "報名", q: "報名後怎麼付款？", a: "線上填好報名表後，會拿到報名編號和查詢連結。依頁面上的資訊匯款並回填帳號末五碼，我們確認後會私訊通知您報名完成。" },
  { cat: "報名", q: "額滿了還可以報名嗎？", a: "可以登記候補，有名額時會依登記順序通知您。" },
  { cat: "報名", q: "沒有達到開課人數怎麼辦？", a: "我們會在開課前通知您，並說明退費方式。" },
  { cat: "報名", q: "臨時不能參加可以退費嗎？", a: "依報名頁上的退費辦法辦理。" },
  { cat: "課程", q: "孩子沒有學過，可以參加嗎？", a: "可以。每個營隊都依孩子的年齡階段設計，從基礎開始，老師會依每個孩子的程度調整。" },
  { cat: "課程", q: "作品可以帶回家嗎？", a: "可以，每個營隊介紹裡都有寫會帶回家的作品。" },
  { cat: "生活", q: "中午怎麼吃？", a: "【待填】自備便當或統一訂餐、能不能加熱。" },
  { cat: "生活", q: "孩子有過敏或需要特別照顧的地方？", a: "報名表可以填寫照護注意事項，老師上課前都會先看過。" },
];
export const DEFAULT_BRING = "水壺\n室內鞋\n薄外套\n個人藥品（需要時）";
export const DEFAULT_PICKUP = "【待填】上下課地點、停車與接送方式。";

export const isPending = (s: string | null | undefined) => !!s && s.includes("【待填】");

// ---------- 日期（台灣時間） ----------
const TZ = "Asia/Taipei";
const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
export const todayTw = (d: Date = new Date()) => ymdFmt.format(d);
export const isoToYmd = (iso: string) => ymdFmt.format(new Date(iso));
const WD = ["日", "一", "二", "三", "四", "五", "六"];
export function fmtMd(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WD[d.getUTCDay()]}）`;
}
export function fmtDays(days: string[]): string {
  if (days.length === 0) return "日期未定";
  if (days.length === 1) return fmtMd(days[0]);
  return `${fmtMd(days[0])} ～ ${fmtMd(days[days.length - 1])}`;
}
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);
}

// 頂端選單要不要出現冬夏令營入口
export function menuVisible(s: Pick<CampSeason, "status" | "menu_mode" | "promo_from">, lastDay: string | null, today = todayTw()): boolean {
  if (s.status !== "published" || s.menu_mode === "off") return false;
  if (s.menu_mode === "on") return true;
  if (!s.promo_from || today < s.promo_from) return false;
  return !lastDay || today <= lastDay;
}

// 早鳥：還剩幾天（含截止當天；已過期為 null）
export function earlyDaysLeft(s: Pick<CampSeason, "early_until">, today = todayTw()): number | null {
  if (!s.early_until || today > s.early_until) return null;
  return daysBetween(today, s.early_until);
}

export const SEAT_TEXT: Record<SeatState, string> = {
  soon: "即將開放報名",
  open: "報名中",
  few: "即將額滿",
  full: "額滿",
  waitlist: "額滿・可候補",
  closed: "報名已截止",
};

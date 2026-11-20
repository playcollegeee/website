// 頂部公告列與右下角最新消息小卡的型別與常數（瀏覽器與伺服器都能引用，不可引用 supabase）

// 公告列：auto＝自動顯示最近一場報名中的活動；custom＝後台自己寫；off＝不顯示
export type NoticeMode = "auto" | "custom" | "off";
export type NoticeSetting = { mode: NoticeMode; text: string; cta: string; href: string };
// 最新消息小卡：runId 空白＝自動挑最近一場
export type NewsSetting = { on: boolean; runId: string | null };

// 一場報名中的活動（給公告列與小卡用）
export type OpenRunSummary = {
  runId: string;
  title: string;
  date: string; // 12/20（日）
  time: string; // 09:00–12:00
  area: string; // 台中場
  image: string | null;
  href: string;
};

export type NoticeBar = { text: string; cta: string; href: string };

export const NOTICE_TEXT_MAX = 40;
export const NOTICE_CTA_MAX = 8;
export const NOTICE_HREF_MAX = 200;

export const DEFAULT_NOTICE: NoticeSetting = { mode: "auto", text: "", cta: "看活動", href: "/workshops" };
export const DEFAULT_NEWS: NewsSetting = { on: true, runId: null };

// 連結只接受本站路徑或 https 網址
export const validHref = (h: string) => /^\/(?!\/)[^\s]*$/.test(h) || /^https:\/\/[^\s]+$/.test(h);

// 自動模式的公告文字：手機只顯示一行，重點放前面
export const autoNoticeText = (r: OpenRunSummary) => `報名中｜${r.title} ${r.date}${r.area ? ` ${r.area}` : ""}`;

// 後台共用：中文標籤與台灣時間格式
import { levels, majors } from "./content";

export const LEVEL_NAME: Record<string, string> = Object.fromEntries(levels.map((l) => [l.slug, l.name]));
export const LEVEL_OPTIONS = levels.map((l) => ({ value: l.slug, label: `${l.name}（${l.grades}）` }));
export const MAJOR_NAME: Record<string, string> = Object.fromEntries(majors.map((m) => [m.slug, m.name]));

// 三大主修對應的角色職業路線
export const TRACK_NAME: Record<string, string> = { lego: "機關工程師", "3d": "造物工匠", art: "色彩魔法師" };

export const CLASS_KIND: Record<string, string> = {
  major: "主修",
  elective: "探索選修",
  workshop: "工作坊",
  camp: "營隊",
  school: "校外合作",
};

export const ATT_STATUS = [
  { value: "present", label: "出席", color: "green" },
  { value: "late", label: "遲到", color: "yellow" },
  { value: "leave", label: "請假", color: "blue" },
  { value: "absent", label: "缺席", color: "red" },
] as const;
export const ATT_LABEL: Record<string, string> = Object.fromEntries(ATT_STATUS.map((s) => [s.value, s.label]));

export const RELATIONS = ["媽媽", "爸爸", "阿嬤", "阿公", "外婆", "外公", "其他"];

const TZ = "Asia/Taipei";
const dFmt = new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, month: "numeric", day: "numeric", weekday: "short" });
const tFmt = new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const fmtDate = (iso: string | Date) => dFmt.format(new Date(iso));
export const fmtTime = (iso: string | Date) => tFmt.format(new Date(iso));
export const fmtDateTime = (iso: string | Date) => `${fmtDate(iso)} ${fmtTime(iso)}`;
export const ymd = (d: Date = new Date()) => ymdFmt.format(d); // 2026-11-04（台灣日期）

// 台灣的某一天 00:00 ～ 隔天 00:00（給資料庫查詢用的 ISO 時間）
export function taipeiDay(dateYmd = ymd()): { start: string; end: string } {
  const start = new Date(`${dateYmd}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}

// 表單的 <input type="datetime-local"> 值（台灣時間）轉成 Date
export function fromTaipeiLocal(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 表單欄位小工具
export function str(fd: FormData, key: string, max = 200): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
export function optStr(fd: FormData, key: string, max = 200): string | null {
  return str(fd, key, max) || null;
}

// 卡號統一格式：去掉冒號、空白，轉大寫（和資料庫 checkin_by_card 規則一致）
export function normalizeUid(v: string): string {
  return v.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

// 老師打卡：超過 16 小時還沒下班的紀錄，視為忘記打下班卡（與資料庫 checkin_by_card 規則一致）
export const OPEN_WINDOW_HOURS = 16;

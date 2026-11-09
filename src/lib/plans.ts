// 課程規劃（migration 0012）共用常數與型別
export const PLAN_KINDS = [
  { value: "season", label: "季主題", icon: "🍂", hint: "一期一個主題；主修 12 堂、走讀課程、工作坊都圍繞主題" },
  { value: "month", label: "月份主題", icon: "📆", hint: "積木故事屋、樂高動滋動，每場的主題就是該月主題" },
  { value: "camp", label: "冬夏令營", icon: "🏕️", hint: "分週排每天上午、下午的課程、流程與材料" },
] as const;
export type PlanKind = (typeof PLAN_KINDS)[number]["value"];
export const PLAN_KIND_LABEL: Record<string, string> = Object.fromEntries(PLAN_KINDS.map((k) => [k.value, k.label]));

export const PLAN_STATUS = [
  { value: "idea", label: "構想" },
  { value: "discuss", label: "討論中" },
  { value: "final", label: "定案" },
] as const;
export const PLAN_STATUS_LABEL: Record<string, string> = Object.fromEntries(PLAN_STATUS.map((s) => [s.value, s.label]));

// 規劃內容的區塊（plan_items.section）
export const SECTIONS: Record<string, { label: string; kind: PlanKind; major?: string; dated?: boolean }> = {
  major_lego: { label: "LEGO 主修 12 堂", kind: "season", major: "lego" },
  major_3d: { label: "3D 列印主修 12 堂", kind: "season", major: "3d" },
  major_art: { label: "美術主修 12 堂", kind: "season", major: "art" },
  walk: { label: "走讀課程", kind: "season", dated: true },
  workshop: { label: "工作坊", kind: "season", dated: true },
  story: { label: "積木故事屋", kind: "month", dated: true },
  move: { label: "樂高動滋動", kind: "month", dated: true },
  camp: { label: "營隊課程", kind: "camp", dated: true },
};
export const MAJOR_SECTIONS = ["major_lego", "major_3d", "major_art"] as const;
export const LIST_SECTIONS: Record<PlanKind, string[]> = { season: ["walk", "workshop"], month: ["story", "move"], camp: [] };
export const MAJOR_LESSONS = 12;

// 營隊每天的時段（2026-11-07 使用者暫定：上午 9:30–12:00、下午 13:30–16:00）
export const CAMP_SLOTS = [
  { value: "am", label: "上午", time: "9:30–12:00" },
  { value: "pm", label: "下午", time: "13:30–16:00" },
] as const;

export type Person = { name: string; nickname: string | null } | null;
export const who = (p: Person) => (p ? p.nickname || p.name : "（已離職）");

export type Plan = {
  id: string; kind: PlanKind; title: string; theme: string | null; start_date: string | null; end_date: string | null; status: string;
  summary: string | null; owner_id: string | null; created_by: string | null; created_at: string; updated_at: string;
  owner?: Person;
};
export type PlanItem = {
  id: string; plan_id: string; section: string; seq: number; day: string | null; slot: string | null; title: string | null;
  lesson_id: string | null; teacher_id: string | null; notes: string | null; updated_at: string;
  lesson?: { id: string; title: string } | null;
  teacher?: Person;
};
export type PlanComment = {
  id: string; plan_id: string; item_id: string | null; idea_id?: string | null; parent_id: string | null; body: string; is_decision: boolean;
  decided_at: string | null; author_id: string | null; created_at: string; updated_at: string; author?: Person;
};
export type PlanTask = {
  id: string; plan_id: string; title: string; assignee_id: string | null; due_date: string | null; done_at: string | null;
  created_by: string | null; created_at: string; assignee?: Person; plan?: { id: string; title: string; kind: string } | null;
};

// 權限：規劃本身與內容由負責老師、建立者或管理員修改；每一項的負責老師可以改那一項
export const canEditPlan = (p: { owner_id: string | null; created_by: string | null }, s: { id: string; is_admin: boolean }) =>
  s.is_admin || p.owner_id === s.id || p.created_by === s.id;

// 日期工具：營隊的每一天（週一到週五），依週分組
export function campDays(start: string | null, end: string | null): { week: number; days: string[] }[] {
  if (!start || !end) return [];
  const out: { week: number; days: string[] }[] = [];
  const d = new Date(start + "T00:00:00Z");
  const last = new Date(end + "T00:00:00Z");
  let week = 0;
  let cur: string[] = [];
  for (let i = 0; d <= last && i < 120; i++) {
    const dow = d.getUTCDay();
    if (dow === 1 && cur.length) { out.push({ week: ++week, days: cur }); cur = []; }
    if (dow >= 1 && dow <= 5) cur.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  if (cur.length) out.push({ week: ++week, days: cur });
  return out;
}
const WD = ["日", "一", "二", "三", "四", "五", "六"];
export const fmtDay = (ymd: string | null) => {
  if (!ymd) return "";
  const d = new Date(ymd + "T00:00:00Z");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WD[d.getUTCDay()]}）`;
};
export const fmtRange = (a: string | null, b: string | null) =>
  a && b ? (a === b ? fmtDay(a) : `${a.replace(/-/g, "/")} ～ ${b.replace(/-/g, "/")}`) : a ? `${a.replace(/-/g, "/")} 起` : "日期未定";

// 新增規劃時依時間自動產生名稱（2026-11-07 使用者決定：主題討論完才填，名稱先用時間）
//   季主題：2027 第1季（依開始月份：1–3 月第 1 季、4–6 月第 2 季…）
//   月份主題：2027 3月份主題
//   冬夏令營：2027冬令營第1梯／2027夏令營第2梯（5–9 月開始算夏令營，其他算冬令營；梯次＝同年同類已有幾梯＋1）
export const campType = (start: string) => {
  const m = Number(start.slice(5, 7));
  return m >= 5 && m <= 9 ? "夏令營" : "冬令營";
};
export function autoTitle(kind: string, start: string, campCount = 0): string {
  if (!/^\d{4}-\d{2}/.test(start)) return "";
  const y = start.slice(0, 4);
  const m = Number(start.slice(5, 7));
  if (kind === "season") return `${y} 第${Math.ceil(m / 3)}季`;
  if (kind === "month") return `${y} ${m}月份主題`;
  return `${y}${campType(start)}第${campCount + 1}梯`;
}
// 月份 YYYY-MM → 該月第一天與最後一天
export function monthRange(ym: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, "0")}` };
}

// 點子牆（migration 0015）：每份規劃每人最多 3 票（2026-11-10 使用者選用「點子牆＋投票」）
export const VOTES_PER_PLAN = 3;
export const IDEA_KINDS = [
  { value: "theme", label: "主題" },
  { value: "activity", label: "活動點子" },
  { value: "other", label: "其他" },
] as const;
export const IDEA_KIND_LABEL: Record<string, string> = Object.fromEntries(IDEA_KINDS.map((k) => [k.value, k.label]));
export type PlanIdea = {
  id: string; plan_id: string; kind: string; title: string; detail: string | null; anonymous: boolean; status: string;
  author_id: string | null; created_at: string; author?: Person; votes?: { teacher_id: string }[];
};
export type AgendaItem = {
  id: string; meeting_id: string; seq: number; title: string; owner_id: string | null; minutes: number | null;
  notes: string | null; result: string | null; created_by: string | null; owner?: Person;
};

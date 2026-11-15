// 冬夏令營頁面：伺服器端讀取資料（官網與後台共用）。只能在伺服器使用。
import { authHeaders, sbGet, supabaseConfig } from "./supabase";
import { slotsWithUsage, type SlotWithUsage } from "./events";
import type { Run } from "./eventTypes";
import { campDays, CAMP_SLOTS } from "./plans";
import {
  BRAND_CYCLE,
  CAMP_TAG,
  SEASON_ICON,
  SEASON_LABEL,
  isoToYmd,
  menuVisible,
  todayTw,
  type CampCard,
  type CampDay,
  type CampProgram,
  type CampSeason,
  type SeatState,
} from "./campTypes";
export * from "./campTypes";



type PlanRow = { id: string; title: string; theme: string | null; start_date: string | null; end_date: string | null; status: string };
type ItemRow = { plan_id: string; day: string | null; slot: "am" | "pm" | null; title: string | null };

export type ProgramBundle = {
  program: CampProgram;
  plan: PlanRow | null;
  run: Run | null;
  slots: SlotWithUsage[];
  items: ItemRow[];
  days: string[];
};

// 一個營隊的上課日：有報名場次就用場次的時間，沒有就用課程規劃的日期（週一～五）
function programDays(plan: PlanRow | null, slots: SlotWithUsage[]): string[] {
  const fromSlots = [...new Set(slots.flatMap((s) => (s.times ?? []).map((t) => isoToYmd(t.start))))].sort();
  if (fromSlots.length) return fromSlots;
  return campDays(plan?.start_date ?? null, plan?.end_date ?? null).flatMap((w) => w.days);
}

export async function loadPrograms(seasonId: string, onlyPublished: boolean): Promise<ProgramBundle[]> {
  const programs = await sbGet<CampProgram[]>(
    `camp_programs?season_id=eq.${seasonId}${onlyPublished ? "&published=eq.true" : ""}&select=*&order=sort,created_at`,
  );
  if (programs.length === 0) return [];
  const planIds = programs.map((p) => p.plan_id).filter(Boolean) as string[];
  const runIds = programs.map((p) => p.run_id).filter(Boolean) as string[];
  const [plans, items, runs, slots] = await Promise.all([
    planIds.length ? sbGet<PlanRow[]>(`plans?id=in.(${planIds.join(",")})&select=id,title,theme,start_date,end_date,status`) : [],
    planIds.length
      ? sbGet<ItemRow[]>(`plan_items?plan_id=in.(${planIds.join(",")})&section=eq.camp&select=plan_id,day,slot,title&order=day,slot`)
      : [],
    runIds.length ? sbGet<Run[]>(`activity_runs?id=in.(${runIds.join(",")})&select=*`) : [],
    runIds.length ? slotsWithUsage(runIds) : [],
  ]);
  const pm = new Map(plans.map((p) => [p.id, p]));
  const rm = new Map(runs.map((r) => [r.id, r]));
  return programs.map((program) => {
    const plan = program.plan_id ? pm.get(program.plan_id) ?? null : null;
    const run = program.run_id ? rm.get(program.run_id) ?? null : null;
    const ss = run ? slots.filter((s) => s.run_id === run.id && s.state !== "cancelled") : [];
    return { program, plan, run, slots: ss, items: items.filter((i) => i.plan_id === program.plan_id), days: programDays(plan, ss) };
  });
}

// 每天上午／下午的內容：官網改寫的文字優先，空白就用課程規劃的名稱
export function buildSchedule(b: Pick<ProgramBundle, "program" | "items" | "days">): CampDay[] {
  return b.days.map((day) => {
    const pick = (slot: "am" | "pm") =>
      (b.program.day_overrides?.[`${day}:${slot}`] ?? "").trim() || (b.items.find((i) => i.day === day && i.slot === slot)?.title ?? "").trim();
    return { day, am: pick("am"), pm: pick("pm") };
  });
}

function seatOf(b: ProgramBundle, today: string): { seat: SeatState; left: number | null } {
  const { run, slots } = b;
  if (!run || run.status === "draft") return { seat: "soon", left: null };
  if (run.status !== "open" || (run.deadline && today > run.deadline)) return { seat: "closed", left: null };
  const open = slots.filter((s) => s.state !== "cancelled");
  if (open.length === 0) return { seat: "soon", left: null };
  const left = open.reduce((n, s) => n + s.left, 0);
  if (left <= 0) return { seat: open.some((s) => s.waitlist) ? "waitlist" : "full", left: 0 };
  return { seat: left <= 3 ? "few" : "open", left };
}

const fmtHm = (iso: string) =>
  new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

// 官網卡片要的資料（不含價格：2026-11-15 使用者決定營隊頁不顯示價格）
export function toCard(b: ProgramBundle, i: number, today = todayTw()): CampCard {
  const { program: p, run, slots } = b;
  const { seat, left } = seatOf(b, today);
  const t = slots[0]?.times?.[0];
  const time_text = t ? `每天 ${fmtHm(t.start)}–${fmtHm(t.end)}` : `每天 ${CAMP_SLOTS[0].time.split("–")[0]}–${CAMP_SLOTS[1].time.split("–")[1]}`;
  return {
    id: p.id,
    title: p.title,
    tagline: p.tagline,
    major: p.major,
    stages: p.stages,
    grade_text: p.grade_text,
    highlights: p.highlights,
    takeaway: p.takeaway,
    cover_url: p.cover_url,
    color: BRAND_CYCLE[i % BRAND_CYCLE.length],
    days: b.days,
    schedule: p.show_schedule ? buildSchedule(b).filter((d) => d.am || d.pm) : [],
    time_text,
    venue: slots[0]?.venue ?? null,
    seat,
    left,
    signup_href: run && (seat === "open" || seat === "few" || seat === "waitlist") ? `/signup/${run.id}` : null,
    notify_href: `/contact?type=workshop&activity=${encodeURIComponent(p.title)}`,
    deadline: run?.deadline ?? null,
  };
}

export const lastDayOf = (bundles: ProgramBundle[]) =>
  bundles.flatMap((b) => b.days).sort().at(-1) ?? null;

// ---------- 官網 ----------
export async function getSeasonBySlug(slug: string): Promise<CampSeason | null> {
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return null;
  return (await sbGet<CampSeason[]>(`camp_seasons?slug=eq.${slug}&select=*`).catch(() => []))[0] ?? null;
}

// /camp：選單上正在宣傳的那一季；沒有的話，選還沒結束、最近的一季；都沒有就選最新一季
export async function getCurrentSeason(): Promise<CampSeason | null> {
  const seasons = await sbGet<CampSeason[]>("camp_seasons?status=eq.published&select=*&order=year.desc,season.asc").catch(() => []);
  if (seasons.length === 0) return null;
  const today = todayTw();
  const withEnd = await Promise.all(seasons.map(async (s) => ({ s, end: lastDayOf(await loadPrograms(s.id, true).catch(() => [])) })));
  return (
    withEnd.find((x) => menuVisible(x.s, x.end, today))?.s ??
    withEnd.filter((x) => x.end && x.end >= today).sort((a, b) => a.end!.localeCompare(b.end!))[0]?.s ??
    seasons[0]
  );
}

// 頂端選單的冬夏令營入口（每頁都會用到，快取一小時；後台存檔會立即更新）
export type CampMenu = { href: string; label: string; season: CampSeason["season"] } | null;
export async function getCampMenu(): Promise<CampMenu> {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  try {
    const sel =
      "slug,title,season,status,menu_mode,promo_from,camp_programs(published,plans(start_date,end_date),activity_runs(activity_slots(times,state)))";
    const res = await fetch(`${cfg.url}/rest/v1/camp_seasons?status=eq.published&menu_mode=neq.off&select=${sel}&order=year.desc`, {
      headers: authHeaders(cfg.key),
      next: { tags: [CAMP_TAG], revalidate: 3600 },
    });
    if (!res.ok) return null;
    type Row = Pick<CampSeason, "slug" | "title" | "season" | "status" | "menu_mode" | "promo_from"> & {
      camp_programs: {
        published: boolean;
        plans: { start_date: string | null; end_date: string | null } | null;
        activity_runs: { activity_slots: { times: { start: string }[]; state: string }[] } | null;
      }[];
    };
    const rows = (await res.json()) as Row[];
    const today = todayTw();
    for (const r of rows) {
      const ends = (r.camp_programs ?? [])
        .filter((p) => p.published)
        .flatMap((p) => {
          const st = (p.activity_runs?.activity_slots ?? []).filter((s) => s.state !== "cancelled").flatMap((s) => s.times ?? []);
          return st.length ? st.map((t) => isoToYmd(t.start)) : p.plans?.end_date ? [p.plans.end_date] : [];
        })
        .sort();
      if (menuVisible(r, ends.at(-1) ?? null, today))
        return { href: "/camp", label: `${SEASON_ICON[r.season]} ${SEASON_LABEL[r.season]}`, season: r.season };
    }
    return null;
  } catch {
    return null;
  }
}

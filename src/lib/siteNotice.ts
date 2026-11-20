// 頂部公告列與右下角最新消息小卡：讀後台設定（site_settings 的 notice、news）與報名中的活動。只能在伺服器使用。
// 官網每一頁都會用到，所以讀取結果都有快取：設定跟著「官網區塊開關」的 tag；報名中的活動 5 分鐘更新一次，後台改開課時也會立即更新
import { authHeaders, supabaseConfig } from "./supabase";
import { SITE_FLAGS_TAG } from "./siteFlags";
import { announcement } from "./content";
import { fmtTimes, runTitle, type Run, type Slot, type Theme } from "./eventTypes";
import {
  DEFAULT_NEWS,
  DEFAULT_NOTICE,
  autoNoticeText,
  type NewsSetting,
  type NoticeBar,
  type NoticeSetting,
  type OpenRunSummary,
} from "./noticeTypes";

export * from "./noticeTypes";
export const OPEN_RUNS_TAG = "open-runs";

async function cachedGet<T>(path: string, tags: string[], revalidate: number): Promise<T | null> {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/rest/v1/${path}`, { headers: authHeaders(cfg.key), next: { tags, revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getNoticeSettings(): Promise<{ notice: NoticeSetting; news: NewsSetting }> {
  const rows = await cachedGet<{ key: string; value: Record<string, unknown> }[]>(
    "site_settings?key=in.(notice,news)&select=key,value",
    [SITE_FLAGS_TAG],
    3600,
  );
  const m = new Map((rows ?? []).map((r) => [r.key, r.value]));
  return {
    notice: { ...DEFAULT_NOTICE, ...((m.get("notice") as Partial<NoticeSetting>) ?? {}) },
    news: { ...DEFAULT_NEWS, ...((m.get("news") as Partial<NewsSetting>) ?? {}) },
  };
}

// 報名中的活動，依最近一場場次排序（已經過的場次不算）
export async function getOpenRunSummaries(): Promise<OpenRunSummary[]> {
  const tags = [OPEN_RUNS_TAG];
  const runs = await cachedGet<Pick<Run, "id" | "theme_id" | "title" | "cover_url">[]>(
    "activity_runs?status=eq.open&select=id,theme_id,title,cover_url",
    tags,
    300,
  );
  if (!runs?.length) return [];
  const ids = runs.map((r) => r.id).join(",");
  const themeIds = [...new Set(runs.map((r) => r.theme_id))].join(",");
  const [themes, slots] = await Promise.all([
    cachedGet<Pick<Theme, "id" | "title" | "cover_url" | "activity_id">[]>(`activity_themes?id=in.(${themeIds})&select=id,title,cover_url,activity_id`, tags, 300),
    cachedGet<Pick<Slot, "run_id" | "label" | "area" | "times" | "first_start" | "state">[]>(
      `activity_slots?run_id=in.(${ids})&state=neq.cancelled&select=run_id,label,area,times,first_start,state&order=first_start`,
      tags,
      300,
    ),
  ]);
  const actIds = [...new Set((themes ?? []).map((t) => t.activity_id).filter(Boolean))];
  const acts = actIds.length
    ? await cachedGet<{ id: string; image_url: string | null }[]>(`activities?id=in.(${actIds.join(",")})&select=id,image_url`, tags, 300)
    : [];
  const tm = new Map((themes ?? []).map((t) => [t.id, t]));
  const am = new Map((acts ?? []).map((a) => [a.id, a.image_url]));
  const now = new Date().toISOString();
  const out: (OpenRunSummary & { sortKey: string })[] = [];
  for (const run of runs) {
    const theme = tm.get(run.theme_id);
    if (!theme) continue;
    const slot = (slots ?? []).find((s) => s.run_id === run.id && (s.first_start ?? "9") >= now) ?? (slots ?? []).find((s) => s.run_id === run.id);
    const when = slot ? fmtTimes(slot.times) : "";
    const [date = "", ...rest] = when.split(" ");
    out.push({
      runId: run.id,
      title: runTitle(run, theme),
      date,
      time: rest.join(" "),
      area: slot?.label?.trim() || slot?.area?.trim() || "",
      image: run.cover_url || theme.cover_url || (theme.activity_id ? am.get(theme.activity_id) ?? null : null),
      href: `/signup/${run.id}`,
      sortKey: slot?.first_start ?? "9",
    });
  }
  return out.sort((a, b) => a.sortKey.localeCompare(b.sortKey)).map(({ sortKey: _, ...r }) => r);
}

// 官網外框用：頂部公告列要顯示什麼、右下角小卡放哪一場
export async function getSiteNotice(): Promise<{ bar: NoticeBar | null; news: OpenRunSummary | null }> {
  const [{ notice, news }, runs] = await Promise.all([getNoticeSettings(), getOpenRunSummaries()]);
  let bar: NoticeBar | null = null;
  if (notice.mode === "custom" && notice.text.trim()) {
    bar = { text: notice.text.trim(), cta: notice.cta.trim() || "看更多", href: notice.href || "/workshops" };
  } else if (notice.mode === "auto") {
    bar = runs[0]
      ? { text: autoNoticeText(runs[0]), cta: "立即報名", href: runs[0].href }
      : announcement.text
        ? { text: announcement.text, cta: announcement.cta, href: announcement.href }
        : null;
  }
  const card = news.on ? (news.runId ? runs.find((r) => r.runId === news.runId) : undefined) ?? runs[0] ?? null : null;
  return { bar, news: card };
}

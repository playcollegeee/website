"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbDelete, sbGet, sbInsert, sbPatch, sbRemoveFile, sbUpload } from "@/lib/supabase";
import { PHOTO_BUCKET } from "@/lib/sitePhotos";
import { str } from "@/lib/admin";
import { campDays, CAMP_SLOTS } from "@/lib/plans";
import {
  CAMP_STAGES,
  CAMP_TAG,
  DEFAULT_BRING,
  DEFAULT_DAY_FLOW,
  DEFAULT_FAQ,
  DEFAULT_PICKUP,
  MAJOR_INFO,
  SEASON_LABEL,
  fmtDays,
  type CampPhoto,
  type CampProgram,
  type CampSeason,
  type FaqItem,
  type FlowStep,
} from "@/lib/campTypes";
import type { Run, Slot } from "@/lib/eventTypes";

export type CampResult = { ok: boolean; message: string };
const OK = (message = "已儲存"): CampResult => ({ ok: true, message });
const NG = (message: string): CampResult => ({ ok: false, message });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "操作失敗");

const TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const MAX_BYTES = 4 * 1024 * 1024;
const FOLDER = "camps";

async function seasonOf(id: string): Promise<CampSeason | null> {
  if (!isUuid(id)) return null;
  return (await sbGet<CampSeason[]>(`camp_seasons?id=eq.${id}&select=*`))[0] ?? null;
}

// 官網快取立即更新（頂端選單、/camp、這一季的頁面、正在報名的活動）
function refresh(s: Pick<CampSeason, "id" | "slug">) {
  updateTag(CAMP_TAG);
  revalidatePath("/camp");
  revalidatePath(`/camp/${s.slug}`);
  revalidatePath("/workshops");
  revalidatePath(`/admin/camps/${s.id}`);
  revalidatePath("/admin/camps");
}

async function uploadImage(fd: FormData): Promise<{ url: string; path: string; width: number; height: number } | null> {
  const file = fd.get("file");
  if (!(file instanceof Blob) || file.size === 0) return null;
  const ext = TYPES[file.type];
  if (!ext) throw new Error("只接受 JPG、PNG 或 WebP 圖片");
  if (file.size > MAX_BYTES) throw new Error("圖片太大（上限 4 MB）");
  const width = Math.min(Math.max(Number(fd.get("width")) || 1200, 50), 4000);
  const height = Math.min(Math.max(Number(fd.get("height")) || 900, 50), 4000);
  const path = `${FOLDER}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const url = await sbUpload(PHOTO_BUCKET, path, file, file.type);
  return { url, path, width, height };
}

function parseJson<T>(v: string, fallback: T): T {
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
const ymdOrNull = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const lines = (v: string, max: number, each = 120) =>
  v.split("\n").map((s) => s.trim().slice(0, each)).filter(Boolean).slice(0, max);

// ======================= 一季 =======================
export async function createSeason(fd: FormData): Promise<void> {
  const staff = await requireStaff(true);
  const year = Number(str(fd, "year", 4));
  const season = str(fd, "season", 10) as CampSeason["season"];
  if (!(year >= 2025 && year <= 2100) || !(season in SEASON_LABEL)) redirect("/admin/camps?err=請選年份與冬令營或夏令營");
  const slug = `${year}-${season}`;
  const dup = await sbGet<{ id: string }[]>(`camp_seasons?slug=eq.${slug}&select=id`);
  if (dup[0]) redirect(`/admin/camps/${dup[0].id}`);
  // 沿用上一季的一天流程、Q&A、要帶什麼、接送說明（改一次以後每季都沿用）
  const prev = (await sbGet<CampSeason[]>("camp_seasons?select=*&order=created_at.desc&limit=1"))[0];
  const row = await sbInsert<CampSeason>("camp_seasons", {
    season,
    year,
    slug,
    title: `${year} ${SEASON_LABEL[season]}`,
    headline: season === "winter" ? "這個寒假，一起動手玩出超能力" : "這個暑假，一起動手玩出超能力",
    intro: "",
    menu_mode: "auto",
    day_flow: prev?.day_flow?.length ? prev.day_flow : DEFAULT_DAY_FLOW,
    faq: prev?.faq?.length ? prev.faq : DEFAULT_FAQ,
    bring: prev?.bring || DEFAULT_BRING,
    pickup: prev?.pickup || DEFAULT_PICKUP,
    created_by: staff.id,
    updated_by: staff.id,
  });
  await audit(actorOf(staff), "camp.season.create", `camp_seasons:${row.id}`, { slug, copiedFrom: prev?.id ?? null });
  redirect(`/admin/camps/${row.id}`);
}

export async function saveSeason(fd: FormData): Promise<CampResult> {
  const staff = await requireStaff(true);
  try {
    const s = await seasonOf(str(fd, "id", 40));
    if (!s) return NG("找不到這一季");
    const title = str(fd, "title", 40);
    if (!title) return NG("請填標題");
    const menu_mode = str(fd, "menu_mode", 10);
    if (!["auto", "on", "off"].includes(menu_mode)) return NG("選單設定不正確");
    const promo_from = ymdOrNull(str(fd, "promo_from", 10));
    if (menu_mode === "auto" && !promo_from) return NG("「依日期自動」要填開始宣傳的日期");
    const day_flow: FlowStep[] = parseJson<FlowStep[]>(str(fd, "day_flow", 6000), [])
      .map((x) => ({ time: String(x.time ?? "").trim().slice(0, 10), title: String(x.title ?? "").trim().slice(0, 30), note: String(x.note ?? "").trim().slice(0, 80) }))
      .filter((x) => x.title)
      .slice(0, 12);
    const faq: FaqItem[] = parseJson<FaqItem[]>(str(fd, "faq", 20000), [])
      .map((x) => ({ cat: String(x.cat ?? "").trim().slice(0, 10) || "其他", q: String(x.q ?? "").trim().slice(0, 120), a: String(x.a ?? "").trim().slice(0, 800) }))
      .filter((x) => x.q && x.a)
      .slice(0, 40);
    const up = await uploadImage(fd);
    await sbPatch(`camp_seasons?id=eq.${s.id}`, {
      title,
      headline: str(fd, "headline", 60),
      intro: str(fd, "intro", 800),
      menu_mode,
      promo_from,
      early_until: ymdOrNull(str(fd, "early_until", 10)),
      early_text: str(fd, "early_text", 80) || null,
      day_flow,
      faq,
      bring: lines(str(fd, "bring", 1000), 20, 40).join("\n"),
      pickup: str(fd, "pickup", 600),
      updated_by: staff.id,
      ...(up ? { cover_url: up.url, cover_path: up.path } : {}),
    });
    if (up && s.cover_path) await sbRemoveFile(PHOTO_BUCKET, s.cover_path);
    await audit(actorOf(staff), "camp.season.update", `camp_seasons:${s.id}`, { title, menu_mode });
    refresh(s);
    return OK();
  } catch (e) {
    return NG(errMsg(e));
  }
}

export async function setSeasonStatus(id: string, status: CampSeason["status"]): Promise<CampResult> {
  const staff = await requireStaff(true);
  const s = await seasonOf(id);
  if (!s || !["draft", "published"].includes(status)) return NG("資料不正確");
  if (status === "published") {
    const n = await sbGet<{ id: string }[]>(`camp_programs?season_id=eq.${id}&published=eq.true&select=id&limit=1`);
    if (!n.length) return NG("請先新增至少一個營隊");
  }
  await sbPatch(`camp_seasons?id=eq.${id}`, { status, updated_by: staff.id });
  await audit(actorOf(staff), "camp.season.status", `camp_seasons:${id}`, { status });
  refresh(s);
  return OK(status === "published" ? "已發布到官網" : "已改回草稿（官網看不到）");
}

export async function deleteSeason(id: string): Promise<CampResult> {
  const staff = await requireStaff(true);
  const s = await seasonOf(id);
  if (!s) return OK("已刪除");
  const n = await sbGet<{ id: string }[]>(`camp_programs?season_id=eq.${id}&select=id&limit=1`);
  if (n.length) return NG("請先刪除這一季的營隊");
  await sbDelete(`camp_seasons?id=eq.${id}`);
  for (const p of [s.cover_path, ...(s.photos ?? []).map((x) => x.path)]) if (p) await sbRemoveFile(PHOTO_BUCKET, p);
  await audit(actorOf(staff), "camp.season.delete", `camp_seasons:${id}`, { slug: s.slug });
  refresh(s);
  redirect("/admin/camps");
}

export async function addSeasonPhoto(fd: FormData): Promise<CampResult> {
  const staff = await requireStaff(true);
  try {
    const s = await seasonOf(str(fd, "id", 40));
    if (!s) return NG("找不到這一季");
    if ((s.photos ?? []).length >= 24) return NG("照片最多 24 張");
    const up = await uploadImage(fd);
    if (!up) return NG("請選照片");
    const photos: CampPhoto[] = [...(s.photos ?? []), { url: up.url, path: up.path, width: up.width, height: up.height }];
    await sbPatch(`camp_seasons?id=eq.${s.id}`, { photos, updated_by: staff.id });
    await audit(actorOf(staff), "camp.photo.add", `camp_seasons:${s.id}`);
    refresh(s);
    return OK("已上傳");
  } catch (e) {
    return NG(errMsg(e));
  }
}

export async function deleteSeasonPhoto(id: string, url: string): Promise<CampResult> {
  const staff = await requireStaff(true);
  const s = await seasonOf(id);
  if (!s) return NG("找不到這一季");
  const p = (s.photos ?? []).find((x) => x.url === url);
  if (!p) return OK("已刪除");
  await sbPatch(`camp_seasons?id=eq.${s.id}`, { photos: s.photos.filter((x) => x.url !== url), updated_by: staff.id });
  if (p.path) await sbRemoveFile(PHOTO_BUCKET, p.path);
  await audit(actorOf(staff), "camp.photo.delete", `camp_seasons:${s.id}`);
  refresh(s);
  return OK("已刪除");
}

// ======================= 營隊 =======================
type PlanRow = { id: string; title: string; theme: string | null; summary: string | null; start_date: string | null; end_date: string | null };

async function nextSort(seasonId: string) {
  const last = await sbGet<{ sort: number }[]>(`camp_programs?season_id=eq.${seasonId}&select=sort&order=sort.desc&limit=1`);
  return (last[0]?.sort ?? 0) + 1;
}

// 建立報名（活動報名的主題＋開課＋場次）：日期從課程規劃帶入，每天 9:30–16:00 全天
// 沿用上一個營隊的報名題目、退費辦法、地點、名額；金額一律留 0，要老師到「活動報名」填好才能開放報名
async function createSignup(staffId: string, s: CampSeason, p: CampProgram, plan: PlanRow | null): Promise<string> {
  const days = campDays(plan?.start_date ?? null, plan?.end_date ?? null).flatMap((w) => w.days);
  const prevProg = (
    await sbGet<{ run_id: string }[]>(`camp_programs?run_id=not.is.null&id=neq.${p.id}&select=run_id&order=created_at.desc&limit=1`)
  )[0];
  const prevRun = prevProg ? (await sbGet<Run[]>(`activity_runs?id=eq.${prevProg.run_id}&select=*`))[0] : undefined;
  const prevSlot = prevRun ? (await sbGet<Slot[]>(`activity_slots?run_id=eq.${prevRun.id}&select=*&order=sort&limit=1`))[0] : undefined;

  const slug = `camp-${s.year}${s.season === "winter" ? "w" : "s"}-${Math.random().toString(36).slice(2, 7)}`;
  const theme = await sbInsert<{ id: string }>("activity_themes", {
    title: p.title,
    slug,
    showcase: "none",
    summary: p.tagline,
    highlights: p.highlights,
    audience_text: p.grade_text,
    duration_text: days.length ? `${days.length} 天全天（${CAMP_SLOTS[0].time.split("–")[0]}–${CAMP_SLOTS[1].time.split("–")[1]}）` : null,
    includes_text: p.takeaway ? `帶回作品：${p.takeaway}` : null,
    cover_url: p.cover_url,
    published: true,
    created_by: staffId,
  });
  const run = await sbInsert<Run>("activity_runs", {
    theme_id: theme.id,
    title: `${s.title}｜${p.title}`,
    status: "draft",
    who: "kids",
    unit: "person",
    pay_mode: prevRun?.pay_mode ?? "now",
    prices: [{ key: "p1", label: "全期（全天）", amount: 0, seats: 1 }],
    questions: prevRun?.questions ?? [],
    refund_text: prevRun?.refund_text ?? null,
    reminder_days: prevRun?.reminder_days ?? 2,
    cover_url: p.cover_url,
    created_by: staffId,
  });
  const pad = (t: string) => t.padStart(5, "0"); // "9:30" → "09:30"
  const [am, pm] = [pad(CAMP_SLOTS[0].time.split("–")[0]), pad(CAMP_SLOTS[1].time.split("–")[1])];
  const times = days.map((d) => ({ start: new Date(`${d}T${am}:00+08:00`).toISOString(), end: new Date(`${d}T${pm}:00+08:00`).toISOString() }));
  await sbInsert("activity_slots", {
    run_id: run.id,
    label: days.length ? fmtDays(days) : plan?.title ?? p.title,
    area: prevSlot?.area ?? "台中",
    venue: prevSlot?.venue ?? null,
    address: prevSlot?.address ?? null,
    times,
    first_start: times[0]?.start ?? null,
    capacity: prevSlot?.capacity ?? 12,
    min_seats: prevSlot?.min_seats ?? 3,
    waitlist: true,
    sort: 1,
  });
  await sbPatch(`camp_programs?id=eq.${p.id}`, { run_id: run.id });
  return run.id;
}

// 從課程規劃一鍵帶入：每一份營隊規劃變成一個營隊，並自動建好報名（草稿）
export async function importPlans(seasonId: string, planIds: string[]): Promise<CampResult> {
  const staff = await requireStaff(true);
  try {
    const s = await seasonOf(seasonId);
    if (!s) return NG("找不到這一季");
    const ids = planIds.filter(isUuid).slice(0, 20);
    if (!ids.length) return NG("請勾選要帶入的營隊規劃");
    const plans = await sbGet<PlanRow[]>(`plans?id=in.(${ids.join(",")})&kind=eq.camp&select=id,title,theme,summary,start_date,end_date`);
    const used = await sbGet<{ plan_id: string }[]>(`camp_programs?plan_id=in.(${ids.join(",")})&select=plan_id`);
    let sort = await nextSort(s.id);
    let n = 0;
    for (const plan of plans.sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))) {
      if (used.some((u) => u.plan_id === plan.id)) continue;
      const p = await sbInsert<CampProgram>("camp_programs", {
        season_id: s.id,
        plan_id: plan.id,
        title: (plan.theme || plan.title).slice(0, 60),
        tagline: (plan.summary ?? "").slice(0, 120),
        major: "mix",
        sort: sort++,
        created_by: staff.id,
      });
      await createSignup(staff.id, s, p, plan);
      n++;
    }
    await audit(actorOf(staff), "camp.import", `camp_seasons:${s.id}`, { plans: n });
    refresh(s);
    revalidatePath("/admin/events");
    return n ? OK(`已帶入 ${n} 個營隊，也建好報名草稿`) : NG("勾選的規劃都已經帶入過了");
  } catch (e) {
    return NG(errMsg(e));
  }
}

export async function addProgram(seasonId: string): Promise<CampResult> {
  const staff = await requireStaff(true);
  const s = await seasonOf(seasonId);
  if (!s) return NG("找不到這一季");
  await sbInsert("camp_programs", { season_id: s.id, title: "新營隊", sort: await nextSort(s.id), created_by: staff.id });
  await audit(actorOf(staff), "camp.program.create", `camp_seasons:${s.id}`);
  refresh(s);
  return OK("已新增，請填內容");
}

async function programOf(id: string): Promise<{ p: CampProgram; s: CampSeason } | null> {
  if (!isUuid(id)) return null;
  const p = (await sbGet<CampProgram[]>(`camp_programs?id=eq.${id}&select=*`))[0];
  if (!p) return null;
  const s = await seasonOf(p.season_id);
  return s ? { p, s } : null;
}

export async function saveProgram(fd: FormData): Promise<CampResult> {
  const staff = await requireStaff(true);
  try {
    const found = await programOf(str(fd, "id", 40));
    if (!found) return NG("找不到這個營隊");
    const { p, s } = found;
    const title = str(fd, "title", 60);
    if (!title) return NG("請填營隊名稱");
    const major = str(fd, "major", 10);
    if (!(major in MAJOR_INFO)) return NG("主修不正確");
    const stages = fd.getAll("stages").map(String).filter((x) => CAMP_STAGES.some((c) => c.slug === x));
    const planId = str(fd, "plan_id", 40);
    const plan_id = isUuid(planId) ? planId : null;
    if (plan_id && plan_id !== p.plan_id) {
      const ok = await sbGet<{ id: string }[]>(`plans?id=eq.${plan_id}&kind=eq.camp&select=id`);
      if (!ok.length) return NG("選的課程規劃不是營隊");
      const dup = await sbGet<{ id: string }[]>(`camp_programs?plan_id=eq.${plan_id}&id=neq.${p.id}&select=id`);
      if (dup.length) return NG("這份課程規劃已經連到其他營隊了");
    }
    const rawOv = parseJson<Record<string, string>>(str(fd, "day_overrides", 8000), {});
    const day_overrides: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawOv)) {
      const t = String(v ?? "").trim().slice(0, 60);
      if (/^\d{4}-\d{2}-\d{2}:(am|pm)$/.test(k) && t) day_overrides[k] = t;
    }
    const fields = {
      title,
      tagline: str(fd, "tagline", 120),
      major,
      stages,
      grade_text: str(fd, "grade_text", 40) || null,
      highlights: lines(str(fd, "highlights", 1200), 6),
      takeaway: str(fd, "takeaway", 80) || null,
      show_schedule: fd.get("show_schedule") === "on",
      published: fd.get("published") === "on",
      plan_id,
      day_overrides,
    };
    const up = await uploadImage(fd);
    await sbPatch(`camp_programs?id=eq.${p.id}`, { ...fields, ...(up ? { cover_url: up.url, cover_path: up.path } : {}) });
    if (up && p.cover_path) await sbRemoveFile(PHOTO_BUCKET, p.cover_path);
    // 報名頁的介紹跟著營隊內容更新（標題、介紹、重點、對象、封面）
    if (p.run_id) {
      const run = (await sbGet<Run[]>(`activity_runs?id=eq.${p.run_id}&select=id,theme_id`))[0];
      if (run) {
        await sbPatch(`activity_themes?id=eq.${run.theme_id}`, {
          title,
          summary: fields.tagline,
          highlights: fields.highlights,
          audience_text: fields.grade_text,
          includes_text: fields.takeaway ? `帶回作品：${fields.takeaway}` : null,
          ...(up ? { cover_url: up.url } : {}),
        });
        await sbPatch(`activity_runs?id=eq.${run.id}`, { title: `${s.title}｜${title}`, ...(up ? { cover_url: up.url } : {}) });
        revalidatePath(`/signup/${run.id}`);
      }
    }
    await audit(actorOf(staff), "camp.program.update", `camp_programs:${p.id}`, { title, published: fields.published });
    refresh(s);
    return OK(up ? "已更換封面並儲存" : "已儲存");
  } catch (e) {
    return NG(errMsg(e));
  }
}

export async function createProgramSignup(id: string): Promise<CampResult> {
  const staff = await requireStaff(true);
  try {
    const found = await programOf(id);
    if (!found) return NG("找不到這個營隊");
    const { p, s } = found;
    if (p.run_id) return OK("已經有報名了");
    const plan = p.plan_id
      ? (await sbGet<PlanRow[]>(`plans?id=eq.${p.plan_id}&select=id,title,theme,summary,start_date,end_date`))[0] ?? null
      : null;
    if (!plan?.start_date || !plan.end_date) return NG("請先連結有日期的課程規劃（或到課程規劃填好營隊日期）");
    await createSignup(staff.id, s, p, plan);
    await audit(actorOf(staff), "camp.program.signup", `camp_programs:${p.id}`);
    refresh(s);
    revalidatePath("/admin/events");
    return OK("已建立報名草稿，請到活動報名填金額後開放報名");
  } catch (e) {
    return NG(errMsg(e));
  }
}

export async function moveProgram(id: string, dir: "up" | "down"): Promise<CampResult> {
  const staff = await requireStaff(true);
  const found = await programOf(id);
  if (!found) return NG("資料不正確");
  const list = await sbGet<{ id: string; sort: number }[]>(`camp_programs?season_id=eq.${found.s.id}&select=id,sort&order=sort,created_at`);
  const i = list.findIndex((x) => x.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return OK("");
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((x, k) => (x.sort === k + 1 ? null : sbPatch(`camp_programs?id=eq.${x.id}`, { sort: k + 1 }))));
  await audit(actorOf(staff), "camp.program.move", `camp_programs:${id}`, { dir });
  refresh(found.s);
  return OK("");
}

// 刪除營隊：只刪官網上的介紹；報名（活動報名的開課與名單）保留，要停止報名請到活動報名處理
export async function deleteProgram(id: string): Promise<CampResult> {
  const staff = await requireStaff(true);
  const found = await programOf(id);
  if (!found) return OK("已刪除");
  await sbDelete(`camp_programs?id=eq.${id}`);
  if (found.p.cover_path) await sbRemoveFile(PHOTO_BUCKET, found.p.cover_path);
  await audit(actorOf(staff), "camp.program.delete", `camp_programs:${id}`, { title: found.p.title, run: found.p.run_id });
  refresh(found.s);
  return OK("已刪除");
}

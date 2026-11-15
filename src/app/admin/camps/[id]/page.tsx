import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet } from "@/lib/supabase";
import { campType, fmtRange } from "@/lib/plans";
import { RUN_STATUS_LABEL } from "@/lib/eventTypes";
import {
  buildSchedule,
  earlyDaysLeft,
  fmtDays,
  fmtMd,
  isPending,
  lastDayOf,
  loadPrograms,
  menuVisible,
  SEASON_ICON,
  SEASON_LABEL,
  todayTw,
  type CampSeason,
} from "@/lib/camps";
import ActBtn from "../../events/ActBtn";
import { addProgram, deleteSeason, setSeasonStatus } from "../actions";
import SeasonForm from "./SeasonForm";
import PlanImport from "./PlanImport";
import ProgramEditor from "./ProgramEditor";
import PhotoManager from "./PhotoManager";

export const metadata = { title: "冬夏令營頁面" };

type PlanOpt = { id: string; title: string; theme: string | null; start_date: string | null; end_date: string | null };

export default async function CampSeasonPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(true);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const s = (await sbGet<CampSeason[]>(`camp_seasons?id=eq.${id}&select=*`))[0];
  if (!s) notFound();
  const [bundles, plans, linked] = await Promise.all([
    loadPrograms(s.id, false),
    sbGet<PlanOpt[]>("plans?kind=eq.camp&select=id,title,theme,start_date,end_date&order=start_date.desc.nullslast&limit=60"),
    sbGet<{ plan_id: string; season_id: string }[]>("camp_programs?plan_id=not.is.null&select=plan_id,season_id"),
  ]);
  const usedPlans = new Set(linked.map((l) => l.plan_id));
  // 可以帶入的：同年、同類（5～9 月開始算夏令營），還沒帶入過的營隊規劃
  const candidates = plans
    .filter((p) => !usedPlans.has(p.id) && p.start_date && p.start_date.startsWith(String(s.year)) && campType(p.start_date) === SEASON_LABEL[s.season])
    .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
  const today = todayTw();
  const last = lastDayOf(bundles.filter((b) => b.program.published));
  const shown = menuVisible(s, last, today);
  const early = earlyDaysLeft(s, today);
  const pendingFaq = s.faq.filter((f) => isPending(f.a)).length + (isPending(s.pickup) ? 1 : 0);
  const notOpen = bundles.filter((b) => b.program.published && b.run?.status !== "open").length;

  return (
    <>
      <p className="hint"><Link href="/admin/camps">← 冬夏令營頁面</Link></p>
      <div className="adm-head">
        <h1>{SEASON_ICON[s.season]} {s.title}</h1>
        <div className="adm-actions">
          <Link className="btn btn-sm" href={`/camp/${s.slug}`} target="_blank">
            {s.status === "published" ? "看官網頁面 ↗" : "預覽（只有老師看得到）↗"}
          </Link>
          {s.status === "published" ? (
            <ActBtn run={setSeasonStatus.bind(null, s.id, "draft")} label="改回草稿" ask="改回草稿後官網就看不到這一季，確定嗎？" />
          ) : (
            <ActBtn run={setSeasonStatus.bind(null, s.id, "published")} label="🚀 發布到官網" className="btn btn-sm primary" />
          )}
        </div>
      </div>

      <div className="cmp-status">
        <span className={`tag ${s.status === "published" ? "tag-green" : ""}`}>{s.status === "published" ? "已發布" : "草稿"}</span>
        <span>
          頂端選單：{shown ? <strong>顯示中</strong> : "未顯示"}
          {s.menu_mode === "auto" && s.promo_from && !shown && today < s.promo_from && `（${fmtMd(s.promo_from)} 起自動出現）`}
          {s.menu_mode === "auto" && last && `，${fmtMd(last)} 後自動收起`}
        </span>
        {early !== null && <span>早鳥倒數 {early} 天</span>}
      </div>
      {s.status !== "published" && <p className="adm-warn">目前是草稿，官網看不到。內容準備好後按右上角「發布到官網」。</p>}
      {pendingFaq > 0 && <p className="adm-warn">⚠ 有 {pendingFaq} 個項目還寫著【待填】（例如午餐、接送），填好才會出現在官網。</p>}
      {notOpen > 0 && (
        <p className="adm-warn">
          ⚠ 有 {notOpen} 個營隊還沒開放報名，官網會顯示「即將開放報名」。到下面每個營隊的「報名」連結填金額、按開放報名。
        </p>
      )}

      <h2 className="ph-h">營隊（{bundles.length}）</h2>
      <PlanImport
        seasonId={s.id}
        plans={candidates.map((p) => ({ id: p.id, label: `${p.theme || p.title}`, sub: `${p.title}｜${fmtRange(p.start_date, p.end_date)}` }))}
      />
      <div className="cmp-programs">
        {bundles.map((b, i) => {
          const sched = buildSchedule({ ...b, program: { ...b.program, day_overrides: {} } });
          return (
            <ProgramEditor
              key={b.program.id}
              program={b.program}
              isFirst={i === 0}
              isLast={i === bundles.length - 1}
              planOptions={plans
                .filter((p) => !usedPlans.has(p.id) || p.id === b.program.plan_id)
                .map((p) => ({ id: p.id, label: `${p.theme || p.title}（${p.title}，${fmtRange(p.start_date, p.end_date)}）` }))}
              planLink={b.plan ? { href: `/admin/plans/${b.plan.id}`, label: `${b.plan.title}｜${fmtRange(b.plan.start_date, b.plan.end_date)}` } : null}
              schedule={sched}
              signup={
                b.run
                  ? {
                      href: `/admin/events/runs/${b.run.id}`,
                      status: RUN_STATUS_LABEL[b.run.status],
                      open: b.run.status === "open",
                      priced: b.run.prices.length > 0 && b.run.prices.every((x) => x.amount > 0),
                      seats: b.slots.map((x) => `${x.label}：${x.used}/${x.capacity} 人`).join("；"),
                    }
                  : null
              }
              daysText={fmtDays(b.days)}
            />
          );
        })}
      </div>
      <p>
        <ActBtn run={addProgram.bind(null, s.id)} label="＋ 手動新增營隊（不從課程規劃帶入）" />
      </p>

      <h2 className="ph-h">頁面內容與設定</h2>
      <SeasonForm season={s} />

      <h2 className="ph-h">營隊照片（{s.photos.length}）</h2>
      <p className="hint">放上以前營隊的照片（已取得家長同意、不拍正臉或已打碼），會出現在官網「創作現場」。</p>
      <PhotoManager seasonId={s.id} photos={s.photos} />

      <h2 className="ph-h">刪除這一季</h2>
      <p className="hint">要先刪掉所有營隊才能刪除。報名資料在「活動報名」，不會一起刪。</p>
      <ActBtn run={deleteSeason.bind(null, s.id)} label="刪除這一季" className="adm-link danger" ask="確定刪除這一季的營隊頁面嗎？" confirmLabel="確定刪除" />
    </>
  );
}

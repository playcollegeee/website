import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import {
  PLAN_KINDS, PLAN_STATUS, PLAN_STATUS_LABEL, fmtRange, who, type Plan, type PlanKind, type PlanTask,
} from "@/lib/plans";
import PlanCreate from "./PlanCreate";
import Tasks from "./Tasks";

export const metadata = { title: "課程規劃" };

type Row = Plan & { plan_comments: { created_at: string }[]; plan_tasks: { done_at: string | null }[]; plan_items: { id: string }[] };

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ kind?: string; status?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const kind = (PLAN_KINDS.some((k) => k.value === sp.kind) ? sp.kind : "season") as PlanKind;
  const status = PLAN_STATUS.some((s) => s.value === sp.status) ? sp.status : "";
  const [plans, myTasks, camps] = await Promise.all([
    sbGet<Row[]>(
      `plans?kind=eq.${kind}${status ? `&status=eq.${status}` : ""}` +
        `&select=*,owner:teachers!plans_owner_id_fkey(name,nickname),plan_comments(created_at),plan_tasks(done_at),plan_items(id)` +
        `&order=start_date.desc.nullsfirst,created_at.desc`,
    ).catch(() => null),
    sbGet<PlanTask[]>(
      `plan_tasks?assignee_id=eq.${staff.id}&done_at=is.null&select=*,plan:plans(id,title,kind)&order=due_date.nullslast`,
    ).catch(() => [] as PlanTask[]),
    kind === "camp" ? sbGet<{ title: string }[]>("plans?kind=eq.camp&select=title").catch(() => []) : Promise.resolve([]),
  ]);
  const campTitles = camps.map((c) => c.title);
  const k = PLAN_KINDS.find((x) => x.value === kind)!;
  const day = (iso: string) => new Date(iso).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" });

  return (
    <>
      <div className="adm-head">
        <h1>課程規劃</h1>
      </div>
      {plans === null && <p className="notice err">還沒建立規劃的資料表，請管理員先在 Supabase 執行 0012。</p>}

      {myTasks.length > 0 && (
        <section className="adm-panel">
          <h2>📌 我的待辦 <small>{myTasks.length} 項</small></h2>
          <Tasks tasks={myTasks} me={staff.id} isAdmin={staff.is_admin} showPlan />
        </section>
      )}

      <nav className="pln-tabs" aria-label="規劃種類">
        {PLAN_KINDS.map((x) => (
          <Link key={x.value} href={`/admin/plans?kind=${x.value}`} className={x.value === kind ? "on" : ""}>{x.icon} {x.label}</Link>
        ))}
      </nav>
      <p className="hint">{k.hint}</p>
      <div className="pln-filter">
        <Link href={`/admin/plans?kind=${kind}`} className={!status ? "on" : ""}>全部</Link>
        {PLAN_STATUS.map((s) => (
          <Link key={s.value} href={`/admin/plans?kind=${kind}&status=${s.value}`} className={status === s.value ? "on" : ""}>{s.label}</Link>
        ))}
      </div>

      <div className="pln-cards">
        {(plans ?? []).map((p) => {
          const open = p.plan_tasks.filter((t) => !t.done_at).length;
          const last = p.plan_comments.map((c) => c.created_at).sort().at(-1);
          return (
            <Link key={p.id} href={`/admin/plans/${p.id}`} className="pln-card">
              <span className={`pln-badge ${p.status}`}>{PLAN_STATUS_LABEL[p.status]}</span>
              <strong>{p.title}</strong>
              <span className={p.theme ? "pln-theme" : "pln-theme none"}>{p.theme ? `主題：${p.theme}` : "主題討論中"}</span>
              <small>📅 {fmtRange(p.start_date, p.end_date)}</small>
              <small>👤 {p.owner_id ? who(p.owner ?? null) : "未指定"}・{p.plan_items.length} 項內容</small>
              <small>💬 {p.plan_comments.length} 則{last ? `（最新 ${day(last)}）` : ""}・📌 {open} 項待辦</small>
            </Link>
          );
        })}
        {plans && plans.length === 0 && <p className="adm-empty">還沒有{k.label}。</p>}
      </div>

      <details className="adm-panel pln-new" open={plans?.length === 0}>
        <summary><h2>＋ 新增{k.label}</h2></summary>
        <PlanCreate kind={kind} campTitles={campTitles} />
      </details>
    </>
  );
}

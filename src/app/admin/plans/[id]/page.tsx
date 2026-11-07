import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet } from "@/lib/supabase";
import {
  CAMP_SLOTS, LIST_SECTIONS, MAJOR_LESSONS, MAJOR_SECTIONS, PLAN_KINDS, PLAN_STATUS_LABEL, SECTIONS,
  campDays, canEditPlan, fmtDay, fmtRange, who,
  type Plan, type PlanComment, type PlanItem, type PlanTask,
} from "@/lib/plans";
import ItemCard, { type LessonOpt } from "../ItemCard";
import Discussion from "../Discussion";
import Tasks from "../Tasks";
import PlanHeader from "../PlanHeader";
import Meetings, { type Meeting } from "../Meetings";
import { sttConfigured } from "@/lib/stt";

export const metadata = { title: "課程規劃" };
export const maxDuration = 60; // 會議逐字稿轉文字、AI 整理最多等 60 秒

type T = { id: string; name: string; nickname: string | null };
const PERSON = "name,nickname";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [plans, items, comments, tasks, teachers, lessons, meetings] = await Promise.all([
    sbGet<Plan[]>(`plans?id=eq.${id}&select=*,owner:teachers!plans_owner_id_fkey(${PERSON})`),
    sbGet<PlanItem[]>(
      `plan_items?plan_id=eq.${id}&select=*,lesson:lessons(id,title),teacher:teachers!plan_items_teacher_id_fkey(${PERSON})&order=day.nullslast,seq,created_at`,
    ),
    sbGet<PlanComment[]>(`plan_comments?plan_id=eq.${id}&select=*,author:teachers!plan_comments_author_id_fkey(${PERSON})&order=created_at`),
    sbGet<PlanTask[]>(`plan_tasks?plan_id=eq.${id}&select=*,assignee:teachers!plan_tasks_assignee_id_fkey(${PERSON})&order=created_at`),
    sbGet<T[]>("teachers?active=eq.true&select=id,name,nickname&order=name"),
    sbGet<{ id: string; title: string; category: { major: string } | null }[]>(
      "lessons?status=neq.archived&select=id,title,category:lesson_categories(major)&order=title",
    ),
    // 會議紀錄（0013 還沒執行時當作沒有）
    sbGet<Meeting[]>(
      `meetings?plan_id=eq.${id}&select=id,title,held_on,status,parts_total,duration_sec,summary,ai_result,applied_at,created_by,created_at,creator:teachers!meetings_created_by_fkey(${PERSON}),parts:meeting_parts(count)&order=held_on.desc.nullslast,created_at.desc`,
    ).catch(() => null),
  ]);
  const plan = plans[0];
  if (!plan) notFound();
  const editable = canEditPlan(plan, staff);
  const kind = PLAN_KINDS.find((k) => k.value === plan.kind)!;
  const lessonOpts: LessonOpt[] = lessons.map((l) => ({ id: l.id, title: l.title, major: l.category?.major ?? null }));
  const cOf = (itemId: string) => comments.filter((c) => c.item_id === itemId);
  const common = { planId: plan.id, canEditPlan: editable, me: staff.id, isAdmin: staff.is_admin, lessons: lessonOpts, teachers };
  const decisions = comments.filter((c) => c.is_decision);
  const itemTitle = (itemId: string | null) => {
    const it = items.find((x) => x.id === itemId);
    if (!it) return "";
    const s = SECTIONS[it.section]?.label ?? "";
    return it.section.startsWith("major_") ? `${s}第 ${it.seq} 堂` : `${s}${it.day ? " " + fmtDay(it.day) : ""}${it.slot ? (it.slot === "am" ? "上午" : "下午") : ""}`;
  };

  return (
    <>
      <div className="adm-head">
        <h1>
          <small className="pln-kind">{kind.icon} {kind.label}</small> {plan.title}
          <span className={`pln-badge ${plan.status}`}>{PLAN_STATUS_LABEL[plan.status]}</span>
        </h1>
        <div className="adm-actions lsn-noprint">
          <a className="btn btn-sm" href={`/admin/plans/${plan.id}/export`}>📄 匯出 Word（給外部講師）</a>
          <Link href={`/admin/plans?kind=${plan.kind}`} className="adm-link">← 課程規劃</Link>
        </div>
      </div>
      <p className="pln-meta">
        📅 {fmtRange(plan.start_date, plan.end_date)}　👤 負責：{plan.owner_id ? who(plan.owner ?? null) : "未指定"}
      </p>
      {plan.summary && <p className="pln-summary">{plan.summary}</p>}
      <PlanHeader plan={plan} canEdit={editable} isAdmin={staff.is_admin} teachers={teachers} />

      <div className="pln-layout">
        <div className="pln-main">
          {plan.kind === "season" && MAJOR_SECTIONS.map((sec) => (
            <details key={sec} className="adm-panel pln-sec" open={items.some((x) => x.section === sec)}>
              <summary><h2>{SECTIONS[sec].label} <small>已安排 {items.filter((x) => x.section === sec && (x.title || x.lesson_id)).length}／{MAJOR_LESSONS}</small></h2></summary>
              {Array.from({ length: MAJOR_LESSONS }, (_, i) => i + 1).map((n) => {
                const it = items.find((x) => x.section === sec && x.seq === n);
                return <ItemCard key={`${sec}-${n}-${it?.updated_at ?? ""}`} {...common} section={sec} seq={n} label={`第 ${n} 堂`} item={it} comments={it ? cOf(it.id) : []} />;
              })}
            </details>
          ))}

          {LIST_SECTIONS[plan.kind as "season" | "month" | "camp"].map((sec) => {
            const list = items.filter((x) => x.section === sec);
            return (
              <section key={sec} className="adm-panel pln-sec">
                <h2>{SECTIONS[sec].label} <small>{list.length} 場</small></h2>
                {list.length === 0 && <p className="muted">還沒有安排。</p>}
                {list.map((it) => <ItemCard key={`${it.id}-${it.updated_at}`} {...common} section={sec} item={it} comments={cOf(it.id)} />)}
                <ItemCard {...common} section={sec} isNew comments={[]} />
              </section>
            );
          })}

          {plan.kind === "camp" && (() => {
            const weeks = campDays(plan.start_date, plan.end_date);
            if (!weeks.length) return <p className="notice err">請先按「編輯主題與日期」設定營隊的開始與結束日期，系統會排出每週每天的上午、下午。</p>;
            return weeks.map((w) => (
              <details key={w.week} className="adm-panel pln-sec" open>
                <summary><h2>第 {w.week} 週 <small>{fmtDay(w.days[0])} ～ {fmtDay(w.days[w.days.length - 1])}</small></h2></summary>
                {w.days.map((d) => (
                  <div key={d} className="pln-day">
                    <h3>{fmtDay(d)}</h3>
                    {CAMP_SLOTS.map((s) => {
                      const it = items.find((x) => x.section === "camp" && x.day === d && x.slot === s.value);
                      return <ItemCard key={`${d}-${s.value}-${it?.updated_at ?? ""}`} {...common} section="camp" day={d} slot={s.value}
                        label={`${s.label} ${s.time}`} item={it} comments={it ? cOf(it.id) : []} />;
                    })}
                  </div>
                ))}
              </details>
            ));
          })()}
          {meetings !== null && (
            <Meetings planId={plan.id} meetings={meetings} teachers={teachers} me={staff.id} isAdmin={staff.is_admin}
              canEditPlan={editable} sttReady={sttConfigured()} />
          )}
        </div>

        <aside className="pln-side">
          <section className="adm-panel">
            <h2>✅ 決議 <small>{decisions.length} 項</small></h2>
            {decisions.length === 0 ? (
              <p className="muted">討論有結論時，負責老師在留言按「標為決議」，就會整理在這裡。</p>
            ) : (
              <ol className="pln-decisions">
                {decisions.map((c) => (
                  <li key={c.id}>
                    {c.body}
                    <small className="muted">　{c.item_id ? `〔${itemTitle(c.item_id)}〕` : ""}{who(c.author ?? null)}・{c.decided_at ? new Date(c.decided_at).toLocaleDateString("zh-TW") : ""}</small>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="adm-panel">
            <h2>📌 待辦 <small>{tasks.filter((t) => !t.done_at).length} 項未完成</small></h2>
            <Tasks planId={plan.id} tasks={tasks} teachers={teachers} me={staff.id} isAdmin={staff.is_admin} canEditPlan={editable} />
          </section>
          <section className="adm-panel">
            <h2>💬 討論 <small>{comments.filter((c) => !c.item_id).length} 則</small></h2>
            <Discussion planId={plan.id} comments={comments.filter((c) => !c.item_id)} me={staff.id} isAdmin={staff.is_admin} canDecide={editable} />
          </section>
        </aside>
      </div>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet } from "@/lib/supabase";
import {
  PLAN_KINDS, PLAN_STATUS_LABEL, SECTIONS, canEditPlan, fmtDay, fmtRange, who,
  type AgendaItem, type Plan, type PlanComment, type PlanIdea, type PlanItem, type PlanTask,
} from "@/lib/plans";
import { type LessonOpt } from "../ItemCard";
import PlanSchedule from "../PlanSchedule";
import Tasks from "../Tasks";
import Discussion from "../Discussion";
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
  const [plans, items, comments, tasks, teachers, lessons, meetings, ideas] = await Promise.all([
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
    // 點子牆（0017 還沒執行時當作沒有）
    sbGet<PlanIdea[]>(
      `plan_ideas?plan_id=eq.${id}&select=*,author:teachers!plan_ideas_author_id_fkey(${PERSON}),votes:plan_votes(teacher_id)&order=created_at`,
    ).catch(() => null),
  ]);
  const plan = plans[0];
  if (!plan) notFound();
  // 匿名點子：伺服器端先拿掉作者，只告訴本人「這是你的」
  const ideasSafe = ideas?.map((x) => (x.anonymous ? { ...x, author: null, author_id: x.author_id === staff.id ? staff.id : null } : x)) ?? null;
  const meetingIds = (meetings ?? []).map((m) => m.id);
  const agenda = meetingIds.length
    ? await sbGet<AgendaItem[]>(
      `meeting_agenda?meeting_id=in.(${meetingIds.join(",")})&select=*,owner:teachers!meeting_agenda_owner_id_fkey(${PERSON})&order=seq,created_at`,
    ).catch(() => [] as AgendaItem[])
    : [];
  const editable = canEditPlan(plan, staff);
  const kind = PLAN_KINDS.find((k) => k.value === plan.kind)!;
  const lessonOpts: LessonOpt[] = lessons.map((l) => ({ id: l.id, title: l.title, major: l.category?.major ?? null }));
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
      <p className={plan.theme ? "pln-theme big" : "pln-theme big none"}>
        {plan.theme ? <>主題：<strong>{plan.theme}</strong></> : "主題還沒決定（討論完後按「編輯名稱、主題與日期」填寫）"}
      </p>
      <p className="pln-meta">
        📅 {fmtRange(plan.start_date, plan.end_date)}　👤 負責：{plan.owner_id ? who(plan.owner ?? null) : "未指定"}
      </p>
      {plan.summary && <p className="pln-summary">{plan.summary}</p>}
      <PlanHeader plan={plan} canEdit={editable} isAdmin={staff.is_admin} teachers={teachers} />

      <div className="pln-layout">
        <div className="pln-main">
          <h2 className="pln-zone">📅 時程安排</h2>
          <PlanSchedule plan={plan} items={items} comments={comments} teachers={teachers} lessons={lessonOpts}
            me={staff.id} isAdmin={staff.is_admin} editable={editable} />
          {meetings !== null && (
            <Meetings planId={plan.id} meetings={meetings} agenda={agenda}
              teachers={teachers} me={staff.id} isAdmin={staff.is_admin} canEditPlan={editable} sttReady={sttConfigured()} />
          )}
        </div>

        <aside className="pln-side">
          <section className="adm-panel">
            <h2>✅ 決議 <small>{decisions.length} 項</small></h2>
            {decisions.length === 0 ? (
              <p className="muted">開會時在會議室把討論標為決議，或匯入錄音請 AI 整理，就會列在這裡。</p>
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
            <h2>💬 討論 <small>{comments.filter((c) => !c.item_id && !c.idea_id).length} 則</small></h2>
            <Discussion planId={plan.id} comments={comments.filter((c) => !c.item_id && !c.idea_id)} me={staff.id} isAdmin={staff.is_admin} canDecide={editable} />
          </section>
          {(() => {
            // 點子牆在會議室；這裡留一行，帶到最新一場會議
            const latest = (meetings ?? []).find((m) => m.status === "planned") ?? (meetings ?? [])[0];
            return (
              <p className="pln-room-hint">
                💡 點子 {ideasSafe?.length ?? 0} 則
                {latest ? <> → <Link href={`/admin/meetings/${latest.id}`}>到{latest.title}的會議室</Link></> : "（安排會議後，在會議室的點子牆貼點子、投票）"}
              </p>
            );
          })()}
        </aside>
      </div>
    </>
  );
}

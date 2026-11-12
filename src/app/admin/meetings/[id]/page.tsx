import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet } from "@/lib/supabase";
import { canEditPlan, fmtDay, who, type AgendaItem, type Plan, type PlanComment, type PlanIdea, type PlanItem, type PlanTask } from "@/lib/plans";
import { canModerate } from "@/lib/board";
import { sttConfigured } from "@/lib/stt";
import Agenda from "../../plans/Agenda";
import Discussion from "../../plans/Discussion";
import IdeaBoard from "../../plans/IdeaBoard";
import MeetingAfter from "../../plans/MeetingAfter";
import PlanSchedule from "../../plans/PlanSchedule";
import Tasks from "../../plans/Tasks";
import { meetingStatus, type Meeting } from "@/lib/meetingTypes";
import { type LessonOpt } from "../../plans/ItemCard";
import Board from "./board/Board";
import Helpers from "./board/Helpers";
import MeetingTitle from "./MeetingTitle";

export const metadata = { title: "會議室" };
export const maxDuration = 60; // 錄音轉文字、AI 整理最多等 60 秒

type T = { id: string; name: string; nickname: string | null };
const PERSON = "name,nickname";
type M = Meeting & { plan_id: string | null; helpers: { teacher_id: string }[] };
type Tk = PlanTask & { meeting_id?: string | null };
type Cm = PlanComment & { meeting_id?: string | null };

// 會議室：開會時要用的都在這一頁（議程、時程安排、白板、上次待辦、決議、這次的待辦、討論、點子牆、開完會後）
// 時程、議程、決議、待辦和規劃頁是同一份資料，兩邊互相連動。會議不一定屬於課程規劃（之後的行政會議也用這一頁）
export default async function MeetingRoom({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [rows, teachersAll] = await Promise.all([
    sbGet<M[]>(
      `meetings?id=eq.${id}&select=id,plan_id,title,held_on,status,parts_total,duration_sec,summary,ai_result,applied_at,created_by,created_at,creator:teachers!meetings_created_by_fkey(${PERSON}),parts:meeting_parts(count),helpers:meeting_helpers(teacher_id)`,
    ).catch(() => null),
    sbGet<(T & { active: boolean })[]>("teachers?select=id,name,nickname,active&order=name"),
  ]);
  if (rows === null) {
    return (
      <div className="adm-panel">
        <h1>會議室</h1>
        <p className="notice err">會議室還沒啟用：請管理員到 Supabase 執行 migration 0018（會議討論白板）。</p>
      </div>
    );
  }
  const m = rows[0];
  if (!m) notFound();
  const teachers = teachersAll.filter((t) => t.active);
  const helperIds = m.helpers.map((h) => h.teacher_id);
  const mod = canModerate(m, helperIds, staff);

  const pid = m.plan_id;
  const [plans, items, comments, tasks, lessons, ideas, agenda] = await Promise.all([
    pid ? sbGet<Plan[]>(`plans?id=eq.${pid}&select=*,owner:teachers!plans_owner_id_fkey(${PERSON})`) : Promise.resolve([] as Plan[]),
    pid ? sbGet<PlanItem[]>(`plan_items?plan_id=eq.${pid}&select=*,lesson:lessons(id,title),teacher:teachers!plan_items_teacher_id_fkey(${PERSON})&order=day.nullslast,seq,created_at`) : Promise.resolve([] as PlanItem[]),
    pid ? sbGet<Cm[]>(`plan_comments?plan_id=eq.${pid}&select=*,author:teachers!plan_comments_author_id_fkey(${PERSON})&order=created_at`) : Promise.resolve([] as Cm[]),
    pid ? sbGet<Tk[]>(`plan_tasks?plan_id=eq.${pid}&select=*,assignee:teachers!plan_tasks_assignee_id_fkey(${PERSON})&order=created_at`) : Promise.resolve([] as Tk[]),
    pid ? sbGet<{ id: string; title: string; category: { major: string } | null }[]>("lessons?status=neq.archived&select=id,title,category:lesson_categories(major)&order=title") : Promise.resolve([]),
    pid ? sbGet<PlanIdea[]>(`plan_ideas?plan_id=eq.${pid}&select=*,author:teachers!plan_ideas_author_id_fkey(${PERSON}),votes:plan_votes(teacher_id)&order=created_at`).catch(() => null) : Promise.resolve(null),
    sbGet<AgendaItem[]>(`meeting_agenda?meeting_id=eq.${id}&select=*,owner:teachers!meeting_agenda_owner_id_fkey(${PERSON})&order=seq,created_at`).catch(() => [] as AgendaItem[]),
  ]);
  const plan = plans[0] ?? null;
  const editable = plan ? canEditPlan(plan, staff) : staff.is_admin;
  const canManage = mod || editable;
  const lessonOpts: LessonOpt[] = lessons.map((l) => ({ id: l.id, title: l.title, major: l.category?.major ?? null }));
  // 匿名點子：伺服器端先拿掉作者
  const ideasSafe = ideas?.map((x) => (x.anonymous ? { ...x, author: null, author_id: x.author_id === staff.id ? staff.id : null } : x)) ?? null;
  // 0019 還沒執行時沒有 meeting_id：全部算「上次」
  const lastTasks = tasks.filter((t) => !t.done_at && t.meeting_id !== m.id);
  const thisTasks = tasks.filter((t) => t.meeting_id === m.id);
  const decisions = comments.filter((c) => c.is_decision)
    .sort((a, b) => Number(b.meeting_id === m.id) - Number(a.meeting_id === m.id) || (a.decided_at ?? "").localeCompare(b.decided_at ?? ""));
  const talk = comments.filter((c) => !c.item_id && !c.idea_id);
  const back = plan ? { href: `/admin/plans/${plan.id}`, label: `回到「${plan.theme || plan.title}」` } : { href: "/admin", label: "回到後台" };

  return (
    <div className="room">
      <p className="lsn-noprint"><Link href={back.href} className="adm-link">← {back.label}</Link></p>
      <div className="room-head">
        <MeetingTitle id={m.id} title={m.title} heldOn={m.held_on} canEdit={canManage} />
        <small className="muted">{m.held_on ? fmtDay(m.held_on) : "未定日期"}・{meetingStatus(m)}{plan ? `・${plan.title}` : ""}</small>
        <Helpers meetingId={m.id} teachers={teachers} helperIds={helperIds} creatorId={m.created_by}
          canSet={staff.is_admin || m.created_by === staff.id || editable} mod={mod} />
      </div>

      <div className="room-layout">
        <div className="room-main">
          <details className="adm-panel room-sec" open>
            <summary><h2>📋 議程 <small>{agenda.length} 項</small></h2></summary>
            <Agenda meetingId={m.id} items={agenda} teachers={teachers} me={staff.id} isAdmin={staff.is_admin}
              canManage={canManage} showResults={m.status === "ready"} />
          </details>

          {plan && (
            <details className="adm-panel room-sec room-schedule">
              <summary><h2>📅 時程安排 <small>和規劃頁同步，點開可以直接排課</small></h2></summary>
              <PlanSchedule plan={plan} items={items} comments={comments} teachers={teachers} lessons={lessonOpts}
                me={staff.id} isAdmin={staff.is_admin} editable={editable} />
            </details>
          )}

          <section className="adm-panel room-board">
            <h2>🧩 討論白板</h2>
            <Board meetingId={m.id} me={staff.id} teachers={teachersAll} title={m.title} />
          </section>

          <details className="adm-panel room-sec" open={m.status !== "planned" && !m.applied_at}>
            <summary><h2>🎙️ 開完會後 <small>匯入錄音，AI 整理摘要、決議、待辦</small></h2></summary>
            <MeetingAfter m={m} planId={pid} teachers={teachers} me={staff.id} isAdmin={staff.is_admin}
              canEditPlan={editable} sttReady={sttConfigured()} />
          </details>
        </div>

        {plan && (
          <aside className="room-side">
            <section className="adm-panel">
              <h2>📌 上次待辦 <small>{lastTasks.length} 項未完成</small></h2>
              <Tasks tasks={lastTasks} me={staff.id} isAdmin={staff.is_admin} canEditPlan={editable} emptyText="沒有上次留下的待辦。" />
            </section>
            <section className="adm-panel">
              <h2>✅ 決議 <small>共 {decisions.length} 項{decisions.some((c) => c.meeting_id === m.id) ? `，這次 ${decisions.filter((c) => c.meeting_id === m.id).length} 項` : ""}</small></h2>
              {decisions.length === 0 ? (
                <p className="muted">在下面的討論按「標為決議」，就會列在這裡。</p>
              ) : (
                <ol className="pln-decisions">
                  {decisions.map((c) => (
                    <li key={c.id} className={c.meeting_id === m.id ? "room-new" : undefined}>
                      {c.meeting_id === m.id && <span className="pln-badge final">這次</span>} {c.body}
                      <small className="muted">　{who(c.author ?? null)}・{c.decided_at ? new Date(c.decided_at).toLocaleDateString("zh-TW") : ""}</small>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section className="adm-panel">
              <h2>📌 這次的待辦 <small>{thisTasks.filter((t) => !t.done_at).length} 項未完成</small></h2>
              <Tasks planId={plan.id} meetingId={m.id} tasks={thisTasks} teachers={teachers} me={staff.id} isAdmin={staff.is_admin}
                canEditPlan={editable} emptyText="開會時想到要做的事，在下面新增。" />
            </section>
            <section className="adm-panel">
              <h2>💬 討論 <small>{talk.length} 則</small></h2>
              <Discussion planId={plan.id} meetingId={m.id} comments={talk} me={staff.id} isAdmin={staff.is_admin} canDecide={editable} />
            </section>
            {ideasSafe !== null && (
              <IdeaBoard planId={plan.id} ideas={ideasSafe} comments={comments.filter((c) => c.idea_id)} me={staff.id}
                isAdmin={staff.is_admin} canEditPlan={editable} hasTheme={!!plan.theme} />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

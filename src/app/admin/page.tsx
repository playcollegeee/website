import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import { OPEN_WINDOW_HOURS, fmtDate, fmtTime, taipeiDay, ymd } from "@/lib/admin";
import PunchCard from "./timesheet/PunchCard";
import Tasks from "./plans/Tasks";
import type { PlanTask } from "@/lib/plans";

export const metadata = { title: "今日課程" };

type Sess = {
  id: string;
  starts_at: string;
  ends_at: string;
  classes: { id: string; name: string; room: string | null; teachers: { name: string; nickname: string | null } | null; enrollments: { status: string }[] };
  attendance: { status: string }[];
};
type Scan = { id: number; uid: string; result: string; scanned_at: string; students: { nickname: string } | null; teachers: { name: string } | null };

const SCAN_LABEL: Record<string, string> = {
  checkin: "簽到", checkout: "下課", already: "重複刷卡", no_session: "沒有對應的課", unknown: "未登記的卡",
  revoked: "停用的卡", teacher_in: "老師上班", teacher_out: "老師下班",
};

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const staff = await requireStaff();
  const { d } = await searchParams;
  const day = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ymd();
  const { start, end } = taipeiDay(day);
  const prev = ymd(new Date(new Date(start).getTime() - 3600_000));
  const next = ymd(new Date(new Date(end).getTime() + 3600_000));

  const since = new Date(Date.now() - OPEN_WINDOW_HOURS * 3600_000).toISOString();
  const [sessions, scans, setup, pendingRegs, myShifts, myTasks] = await Promise.all([
    sbGet<Sess[]>(
      `sessions?starts_at=gte.${start}&starts_at=lt.${end}&order=starts_at` +
        `&select=id,starts_at,ends_at,classes(id,name,room,teachers(name,nickname),enrollments(status)),attendance(status)`,
    ),
    sbGet<Scan[]>(`card_scans?order=id.desc&limit=12&select=id,uid,result,scanned_at,students(nickname),teachers(name)`),
    Promise.all([
      sbGet<{ id: string }[]>("teachers?select=id&limit=2"),
      sbGet<{ id: string }[]>("devices?select=id&active=eq.true&limit=1"),
      sbGet<{ id: string }[]>("classes?select=id&limit=1"),
      sbGet<{ id: string }[]>("students?select=id&limit=1"),
    ]),
    sbGet<{ id: string }[]>("registration_requests?status=eq.pending&select=id").catch(() => []),
    // 我的最近打卡：判斷是否上班中，並提供常用地點
    sbGet<{ check_in_at: string; check_out_at: string | null; location: string | null }[]>(
      `teacher_attendance?teacher_id=eq.${staff.id}&order=check_in_at.desc&limit=30&select=check_in_at,check_out_at,location`,
    ).catch(() => []),
    // 課程規劃裡指派給我的待辦
    sbGet<PlanTask[]>(
      `plan_tasks?assignee_id=eq.${staff.id}&done_at=is.null&select=*,plan:plans(id,title,kind)&order=due_date.nullslast&limit=20`,
    ).catch(() => [] as PlanTask[]),
  ]);
  const openShift = myShifts.find((x) => !x.check_out_at && x.check_in_at >= since) ?? null;
  const places = [...new Set(["玩學院教室", ...myShifts.map((x) => x.location).filter((x): x is string => !!x)])];
  const lastPlace = myShifts.find((x) => x.location)?.location;
  const suggestions = lastPlace ? [lastPlace, ...places.filter((p) => p !== lastPlace)] : places;
  const [teachers, devices, classes, students] = setup;
  const todo = [
    { done: students.length > 0, text: "新增第一位學生（含家長與同意書）", href: "/admin/students/new" },
    { done: classes.length > 0, text: "建立第一個班，並把學生加進班裡", href: "/admin/classes" },
    ...(staff.is_admin
      ? [
          { done: devices.length > 0, text: "在教室平板啟用讀卡站", href: "/admin/devices" },
          { done: teachers.length > 1, text: "幫其他老師開帳號", href: "/admin/teachers" },
        ]
      : []),
  ].filter((t) => !t.done);

  return (
    <>
      <div className="adm-head">
        <h1>{day === ymd() ? "今日課程" : "課程"}・{fmtDate(start)}</h1>
        <div className="adm-actions">
          <Link className="btn btn-sm" href={`/admin?d=${prev}`}>← 前一天</Link>
          {day !== ymd() && <Link className="btn btn-sm" href="/admin">今天</Link>}
          <Link className="btn btn-sm" href={`/admin?d=${next}`}>後一天 →</Link>
        </div>
      </div>

      <PunchCard
        open={openShift ? { since: openShift.check_in_at, location: openShift.location } : null}
        suggestions={suggestions}
      />

      {pendingRegs.length > 0 && (
        <p className="notice err">
          有 {pendingRegs.length} 筆線上報名等待審核。<Link href="/admin/registrations">前往審核 →</Link>
        </p>
      )}

      {myTasks.length > 0 && (
        <div className="adm-panel">
          <h2>📌 我的待辦 <small>{myTasks.length} 項</small></h2>
          <Tasks tasks={myTasks} me={staff.id} isAdmin={staff.is_admin} showPlan />
        </div>
      )}

      {todo.length > 0 && (
        <div className="adm-panel adm-setup">
          <h2>開始使用</h2>
          <ol>
            {todo.map((t) => (
              <li key={t.href}><Link href={t.href}>{t.text}</Link></li>
            ))}
          </ol>
        </div>
      )}

      {sessions.length === 0 ? (
        <p className="adm-empty">這天沒有排課。</p>
      ) : (
        <ul className="adm-sessions">
          {sessions.map((s) => {
            const enrolled = s.classes.enrollments.filter((e) => e.status === "active").length;
            const here = s.attendance.filter((a) => a.status === "present" || a.status === "late").length;
            const t = s.classes.teachers;
            return (
              <li key={s.id}>
                <Link href={`/admin/sessions/${s.id}`} className="adm-session">
                  <span className="adm-session-time">{fmtTime(s.starts_at)}<small>–{fmtTime(s.ends_at)}</small></span>
                  <span className="adm-session-name">
                    <strong>{s.classes.name}</strong>
                    <small>{[s.classes.room && `${s.classes.room} 教室`, t && (t.nickname ?? t.name)].filter(Boolean).join("・")}</small>
                  </span>
                  <span className={`adm-count ${here >= enrolled && enrolled > 0 ? "full" : ""}`}>
                    {here}<small>／{enrolled} 到</small>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="adm-panel">
        <h2>最近刷卡</h2>
        {scans.length === 0 ? (
          <p className="adm-empty">還沒有刷卡紀錄。</p>
        ) : (
          <table className="adm-table">
            <tbody>
              {scans.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDate(s.scanned_at)} {fmtTime(s.scanned_at)}</td>
                  <td>{s.students?.nickname ?? s.teachers?.name ?? <code>{s.uid}</code>}</td>
                  <td>
                    <span className={`tag ${s.result === "unknown" || s.result === "no_session" ? "tag-red" : "tag-gray"}`}>
                      {SCAN_LABEL[s.result] ?? s.result}
                    </span>
                    {s.result === "unknown" && <Link href={`/admin/cards?uid=${s.uid}`} className="adm-inline">綁定這張卡</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

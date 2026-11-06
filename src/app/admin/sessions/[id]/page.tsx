import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet } from "@/lib/supabase";
import { ATT_STATUS, LEVEL_NAME, fmtDate, fmtTime } from "@/lib/admin";
import { setAttendance, setAttendanceNote } from "../actions";
import RollButtons from "../RollButtons";

export const metadata = { title: "點名" };

type Sess = {
  id: string; starts_at: string; ends_at: string; class_id: string;
  lessons: { id: string; title: string; goals: string | null; summary: string | null } | null;
  classes: { name: string; room: string | null; enrollments: { status: string; students: { id: string; nickname: string; name: string; level: string; notes: string | null; care_notes: string | null } }[] };
  attendance: { id: string; student_id: string; status: string; checked_in_at: string | null; checked_out_at: string | null; source: string; note: string | null }[];
};

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const rows = await sbGet<Sess[]>(
    `sessions?id=eq.${id}&select=id,starts_at,ends_at,class_id,lessons(id,title,goals,summary),` +
      `classes(name,room,enrollments(status,students(id,nickname,name,level,notes,care_notes))),` +
      `attendance(id,student_id,status,checked_in_at,checked_out_at,source,note)`,
  );
  const s = rows[0];
  if (!s) notFound();

  // 名單：目前在班上的學生＋已經有出席紀錄的學生（例如之後退出的）
  const byId = new Map(s.attendance.map((a) => [a.student_id, a]));
  const list = s.classes.enrollments
    .filter((e) => e.status === "active" || byId.has(e.students.id))
    .map((e) => e.students)
    .sort((a, b) => a.nickname.localeCompare(b.nickname, "zh-Hant"));
  const here = s.attendance.filter((a) => a.status === "present" || a.status === "late").length;

  return (
    <>
      <div className="adm-head">
        <h1>
          {s.classes.name}
          <small>{fmtDate(s.starts_at)} {fmtTime(s.starts_at)}–{fmtTime(s.ends_at)}{s.classes.room && `・${s.classes.room} 教室`}</small>
        </h1>
        <Link href={`/admin/classes/${s.class_id}`} className="adm-link">← 班級</Link>
      </div>

      <div className="adm-panel">
        <p className="adm-lesson">
          {s.lessons ? (
            <>今日教案：<Link href={`/admin/lessons/${s.lessons.id}`} className="adm-strong">{s.lessons.title}</Link>{(s.lessons.summary || s.lessons.goals) && <><br /><small>{s.lessons.summary ?? s.lessons.goals}</small></>}</>
          ) : (
            <>這堂還沒有指定教案，可以到<Link href={`/admin/classes/${s.class_id}`}>班級頁</Link>選。</>
          )}
        </p>
        <p className="adm-big-count"><strong>{here}</strong>／{list.length} 位已到</p>
      </div>

      {list.length === 0 ? (
        <p className="adm-empty">這班還沒有學生。</p>
      ) : (
        <ul className="adm-roll">
          {list.map((st) => {
            const a = byId.get(st.id);
            return (
              <li key={st.id} className={a ? `st-${a.status}` : ""}>
                <div className="adm-roll-who">
                  <Link href={`/admin/students/${st.id}`}><strong>{st.nickname}</strong></Link>
                  <small>{st.name}・{LEVEL_NAME[st.level]}</small>
                  {a?.checked_in_at && (
                    <small>
                      {fmtTime(a.checked_in_at)} {a.source === "card" ? "刷卡" : "老師點名"}
                      {a.checked_out_at && `・${fmtTime(a.checked_out_at)} 下課`}
                    </small>
                  )}
                  {st.care_notes && <small className="adm-warn">⚠ {st.care_notes}</small>}
                  {st.notes && <small>📝 {st.notes}</small>}
                </div>
                <RollButtons
                  sessionId={id}
                  studentId={st.id}
                  nickname={st.nickname}
                  current={a?.status ?? null}
                  options={ATT_STATUS}
                  action={setAttendance}
                />
                {a && (
                  <form action={setAttendanceNote} className="adm-roll-note">
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="session_id" value={id} />
                    <input name="note" defaultValue={a.note ?? ""} placeholder="備註（例：提早接走）" aria-label="備註" maxLength={300} />
                    <button className="adm-link" type="submit">存</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

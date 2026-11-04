import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet } from "@/lib/supabase";
import { CLASS_KIND, LEVEL_NAME, MAJOR_NAME, fmtDate, fmtTime } from "@/lib/admin";
import { addSession, moveSession, updateClass } from "../actions";
import { enrollStudent, setEnrollmentStatus } from "../../students/actions";

export const metadata = { title: "班級" };

type Cls = {
  id: string; name: string; room: string | null; capacity: number; note: string | null; teacher_id: string | null;
  courses: { title: string; kind: string; major: string | null };
  enrollments: { status: string; students: { id: string; nickname: string; name: string; level: string } }[];
  sessions: { id: string; starts_at: string; ends_at: string; lessons: { seq: number; title: string } | null; attendance: { status: string }[] }[];
};

// datetime-local 的預設值（台灣時間）
const localValue = (iso: string) =>
  new Date(new Date(iso).getTime() + 8 * 3600000).toISOString().slice(0, 16);

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [rows, teachers, students] = await Promise.all([
    sbGet<Cls[]>(
      `classes?id=eq.${id}&select=id,name,room,capacity,note,teacher_id,courses(title,kind,major),` +
        `enrollments(status,students(id,nickname,name,level)),sessions(id,starts_at,ends_at,lessons(seq,title),attendance(status))` +
        `&sessions.order=starts_at`,
    ),
    sbGet<{ id: string; name: string; nickname: string | null }[]>("teachers?active=eq.true&order=name&select=id,name,nickname"),
    sbGet<{ id: string; nickname: string; name: string }[]>("students?active=eq.true&order=nickname&select=id,nickname,name"),
  ]);
  const c = rows[0];
  if (!c) notFound();
  const active = c.enrollments.filter((e) => e.status === "active");
  const enrolled = new Set(c.enrollments.map((e) => e.students.id));
  const now = Date.now();

  return (
    <>
      <div className="adm-head">
        <h1>{c.name} <small>{c.courses.title}・{CLASS_KIND[c.courses.kind]}{c.courses.major && `・${MAJOR_NAME[c.courses.major]}`}</small></h1>
        <Link href="/admin/classes" className="adm-link">← 回開班列表</Link>
      </div>

      <div className="adm-cols">
        <section className="adm-panel">
          <h2>堂次 <small>{c.sessions.length} 堂</small></h2>
          <table className="adm-table">
            <tbody>
              {c.sessions.map((s, i) => {
                const here = s.attendance.filter((a) => a.status === "present" || a.status === "late").length;
                const isPast = new Date(s.ends_at).getTime() < now;
                return (
                  <tr key={s.id} className={isPast ? "muted" : ""}>
                    <td>第 {i + 1} 堂</td>
                    <td><Link href={`/admin/sessions/${s.id}`} className="adm-strong">{fmtDate(s.starts_at)} {fmtTime(s.starts_at)}</Link></td>
                    <td>{s.lessons ? s.lessons.title : <span className="muted">未指定教案</span>}</td>
                    <td>{s.attendance.length ? `${here}／${active.length} 到` : ""}</td>
                    <td>
                      <details className="adm-pop">
                        <summary>改時間</summary>
                        <form action={moveSession} className="adm-inline-form">
                          <input type="hidden" name="id" value={s.id} />
                          <input type="datetime-local" name="start" required defaultValue={localValue(s.starts_at)} aria-label="新的開始時間" />
                          <button className="btn btn-sm" type="submit">儲存</button>
                        </form>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <details className="adm-add">
            <summary>＋ 加開一堂（補課）</summary>
            <form action={addSession} className="adm-inline-form">
              <input type="hidden" name="class_id" value={id} />
              <input type="datetime-local" name="start" required aria-label="開始時間" />
              <input type="number" name="minutes" defaultValue={90} min={15} max={480} aria-label="分鐘" />
              <button className="btn btn-sm" type="submit">新增</button>
            </form>
          </details>
        </section>

        <div>
          <section className="adm-panel">
            <h2>學生 <small>{active.length}／{c.capacity}</small></h2>
            <ul className="adm-rows">
              {c.enrollments.map((e) => (
                <li key={e.students.id} className={e.status === "active" ? "" : "muted"}>
                  <Link href={`/admin/students/${e.students.id}`}>{e.students.nickname}</Link>
                  <small>{e.students.name}・{LEVEL_NAME[e.students.level]}</small>
                  {e.status !== "active" && <span className="tag tag-gray">已退出</span>}
                  <form action={setEnrollmentStatus}>
                    <input type="hidden" name="student_id" value={e.students.id} />
                    <input type="hidden" name="class_id" value={id} />
                    <input type="hidden" name="status" value={e.status === "active" ? "cancelled" : "active"} />
                    <button className="adm-link" type="submit">{e.status === "active" ? "退出" : "恢復"}</button>
                  </form>
                </li>
              ))}
            </ul>
            {active.length >= c.capacity && <p className="notice err">已達人數上限。</p>}
            <form action={enrollStudent} className="adm-inline-form">
              <input type="hidden" name="class_id" value={id} />
              <select name="student_id" required defaultValue="" aria-label="選擇學生">
                <option value="" disabled>加入學生…</option>
                {students.filter((s) => !enrolled.has(s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.nickname}（{s.name}）</option>
                ))}
              </select>
              <button className="btn btn-sm" type="submit">加入</button>
            </form>
          </section>

          <section className="adm-panel">
            <h2>班級設定</h2>
            <form action={updateClass} className="adm-grid">
              <input type="hidden" name="id" value={id} />
              <div className="field adm-wide"><label htmlFor="c-name">班名</label><input id="c-name" name="name" defaultValue={c.name} required /></div>
              <div className="field">
                <label htmlFor="c-teacher">老師</label>
                <select id="c-teacher" name="teacher_id" defaultValue={c.teacher_id ?? ""}>
                  <option value="">未指定</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.nickname ?? t.name}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="c-room">教室</label><input id="c-room" name="room" defaultValue={c.room ?? ""} /></div>
              <div className="field"><label htmlFor="c-cap">人數上限</label><input id="c-cap" name="capacity" type="number" min={1} max={100} defaultValue={c.capacity} /></div>
              <div className="field adm-wide"><label htmlFor="c-note">備註</label><textarea id="c-note" name="note" rows={2} defaultValue={c.note ?? ""} /></div>
              <div className="adm-wide"><button className="btn btn-sm" type="submit">儲存</button></div>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}

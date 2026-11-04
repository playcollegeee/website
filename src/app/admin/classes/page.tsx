import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import { CLASS_KIND, LEVEL_NAME, LEVEL_OPTIONS, MAJOR_NAME, fmtDate, ymd } from "@/lib/admin";
import { createClass } from "./actions";
import CourseChooser from "./CourseChooser";

export const metadata = { title: "開班" };

type Cls = {
  id: string; name: string; room: string | null; capacity: number; starts_on: string | null; ends_on: string | null;
  courses: { title: string; kind: string; major: string | null };
  teachers: { name: string; nickname: string | null } | null;
  enrollments: { status: string }[];
};

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ past?: string }> }) {
  await requireStaff();
  const { past } = await searchParams;
  const today = ymd();
  const [classes, courses, teachers] = await Promise.all([
    sbGet<Cls[]>(
      `classes?order=starts_on.desc.nullslast,name${past ? "" : `&or=(ends_on.is.null,ends_on.gte.${today})`}` +
        `&select=id,name,room,capacity,starts_on,ends_on,courses(title,kind,major),teachers(name,nickname),enrollments(status)`,
    ),
    sbGet<{ id: string; title: string; kind: string }[]>("courses?order=title&select=id,title,kind"),
    sbGet<{ id: string; name: string; nickname: string | null }[]>("teachers?active=eq.true&order=name&select=id,name,nickname"),
  ]);

  return (
    <>
      <div className="adm-head">
        <h1>開班</h1>
        <div className="adm-actions">
          <Link className="btn btn-sm" href={past ? "/admin/classes" : "/admin/classes?past=1"}>{past ? "只看進行中" : "含已結束"}</Link>
        </div>
      </div>

      {classes.length === 0 ? (
        <p className="adm-empty">還沒有班級。用下方表單建立第一個班，系統會自動排好每一堂。</p>
      ) : (
        <div className="adm-scroll">
          <table className="adm-table">
            <thead><tr><th>班名</th><th>課程</th><th>老師</th><th>教室</th><th>人數</th><th>期間</th></tr></thead>
            <tbody>
              {classes.map((c) => {
                const n = c.enrollments.filter((e) => e.status === "active").length;
                return (
                  <tr key={c.id}>
                    <td><Link className="adm-strong" href={`/admin/classes/${c.id}`}>{c.name}</Link></td>
                    <td>{c.courses.title}<br /><small>{CLASS_KIND[c.courses.kind]}{c.courses.major && `・${MAJOR_NAME[c.courses.major]}`}</small></td>
                    <td>{c.teachers ? c.teachers.nickname ?? c.teachers.name : "—"}</td>
                    <td>{c.room ?? "—"}</td>
                    <td>{n}／{c.capacity}</td>
                    <td>{c.starts_on && fmtDate(c.starts_on)}{c.ends_on && ` – ${fmtDate(c.ends_on)}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <form action={createClass} className="adm-panel adm-form">
        <h2>建立新班</h2>
        <CourseChooser
          courses={courses.map((c) => ({ id: c.id, label: `${c.title}（${CLASS_KIND[c.kind]}）` }))}
          kinds={Object.entries(CLASS_KIND)}
          majors={Object.entries(MAJOR_NAME)}
          levels={LEVEL_OPTIONS.map((l) => [l.value, LEVEL_NAME[l.value]])}
        />
        <div className="adm-grid">
          <div className="field">
            <label htmlFor="name">班名 *</label>
            <input id="name" name="name" required maxLength={60} placeholder="例：2027 春季 玩樂 LEGO 週六 A" />
          </div>
          <div className="field">
            <label htmlFor="teacher_id">授課老師</label>
            <select id="teacher_id" name="teacher_id" defaultValue="">
              <option value="">未指定</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.nickname ?? t.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="room">教室</label>
            <input id="room" name="room" maxLength={20} placeholder="例：A" />
            <small>和讀卡站設定的教室相同時，刷卡會優先對到這個班</small>
          </div>
          <div className="field">
            <label htmlFor="capacity">人數上限</label>
            <input id="capacity" name="capacity" type="number" min={1} max={100} defaultValue={8} />
          </div>
          <div className="field">
            <label htmlFor="first">第一堂日期時間 *</label>
            <input id="first" name="first" type="datetime-local" required />
          </div>
          <div className="field">
            <label htmlFor="count">堂數</label>
            <input id="count" name="count" type="number" min={1} max={60} defaultValue={12} />
          </div>
          <div className="field">
            <label htmlFor="minutes">每堂分鐘</label>
            <input id="minutes" name="minutes" type="number" min={15} max={480} step={5} defaultValue={90} />
          </div>
          <div className="field">
            <label htmlFor="every">每隔幾天上一次</label>
            <input id="every" name="every" type="number" min={1} max={31} defaultValue={7} />
            <small>每週一次填 7；營隊連續上課填 1</small>
          </div>
        </div>
        <p className="hint">建立後會自動產生每一堂；課程若已有教案，會依序把第 1、2、3… 堂教案掛上去。遇到停課可以在班級頁改單堂時間。</p>
        <button type="submit" className="btn primary">建立並排課</button>
      </form>
    </>
  );
}

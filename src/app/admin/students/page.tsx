import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import { LEVEL_NAME, LEVEL_OPTIONS } from "@/lib/admin";

export const metadata = { title: "學生" };

type Row = {
  id: string;
  name: string;
  nickname: string;
  level: string;
  active: boolean;
  photo_consent: boolean;
  student_guardians: { relation: string | null; is_primary: boolean; guardians: { name: string; phone: string | null } }[];
  cards: { uid: string; revoked_at: string | null }[];
  enrollments: { status: string; classes: { name: string } }[];
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; level?: string; all?: string }>;
}) {
  await requireStaff();
  const { q = "", level = "", all } = await searchParams;
  const params = new URLSearchParams({
    select:
      "id,name,nickname,level,active,photo_consent,student_guardians(relation,is_primary,guardians(name,phone)),cards(uid,revoked_at),enrollments(status,classes(name))",
    order: "level,nickname",
    limit: "500",
  });
  if (!all) params.set("active", "eq.true");
  if (LEVEL_NAME[level]) params.set("level", `eq.${level}`);
  const term = q.trim().replace(/[,()*]/g, "").slice(0, 30);
  if (term) params.set("or", `(name.ilike.*${term}*,nickname.ilike.*${term}*)`);
  const rows = await sbGet<Row[]>(`students?${params}`);

  return (
    <>
      <div className="adm-head">
        <h1>學生 <small>{rows.length} 位</small></h1>
        <div className="adm-actions">
          <Link href="/admin/students/new" className="btn btn-sm primary">＋ 新增學生</Link>
        </div>
      </div>

      <form className="adm-filters" role="search">
        <input name="q" defaultValue={q} placeholder="搜尋姓名或暱稱" aria-label="搜尋姓名或暱稱" />
        <select name="level" defaultValue={level} aria-label="階段">
          <option value="">全部階段</option>
          {LEVEL_OPTIONS.map((l) => <option key={l.value} value={l.value}>{LEVEL_NAME[l.value]}</option>)}
        </select>
        <label className="adm-check"><input type="checkbox" name="all" value="1" defaultChecked={!!all} /> 含已離開</label>
        <button className="btn btn-sm" type="submit">篩選</button>
      </form>

      {rows.length === 0 ? (
        <p className="adm-empty">{term || level ? "找不到符合的學生。" : "還沒有學生資料，先新增第一位吧。"}</p>
      ) : (
        <div className="adm-scroll">
          <table className="adm-table">
            <thead>
              <tr><th>角色暱稱</th><th>姓名</th><th>階段</th><th>主要聯絡人</th><th>班級</th><th>卡片</th></tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const g = s.student_guardians.find((x) => x.is_primary) ?? s.student_guardians[0];
                const cards = s.cards.filter((c) => !c.revoked_at).length;
                const classes = s.enrollments.filter((e) => e.status === "active").map((e) => e.classes.name);
                return (
                  <tr key={s.id} className={s.active ? "" : "muted"}>
                    <td><Link href={`/admin/students/${s.id}`} className="adm-strong">{s.nickname}</Link></td>
                    <td>{s.name}{!s.active && <span className="tag tag-gray">已離開</span>}</td>
                    <td>{LEVEL_NAME[s.level]}</td>
                    <td>{g ? <>{g.guardians.name}{g.relation && `（${g.relation}）`}<br /><small>{g.guardians.phone}</small></> : "—"}</td>
                    <td>{classes.length ? classes.join("、") : <span className="muted">未報名</span>}</td>
                    <td>{cards ? `${cards} 張` : <span className="tag tag-red">未發卡</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

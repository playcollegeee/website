import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import { fmtDateTime, taipeiDay } from "@/lib/admin";
import { updateTeacher } from "./actions";
import NewTeacherForm from "./NewTeacherForm";

export const metadata = { title: "老師" };

type T = {
  id: string; name: string; nickname: string | null; email: string | null; phone: string | null;
  is_admin: boolean; active: boolean; auth_user_id: string | null;
  cards: { uid: string; revoked_at: string | null }[];
};
type Shift = { teacher_id: string; check_in_at: string; check_out_at: string | null };

export default async function TeachersPage() {
  const me = await requireStaff(true);
  const since = taipeiDay().start;
  const weekAgo = new Date(new Date(since).getTime() - 6 * 86400000).toISOString();
  const [teachers, shifts] = await Promise.all([
    sbGet<T[]>("teachers?order=active.desc,name&select=id,name,nickname,email,phone,is_admin,active,auth_user_id,cards(uid,revoked_at)"),
    sbGet<Shift[]>(`teacher_attendance?check_in_at=gte.${weekAgo}&order=check_in_at.desc&select=teacher_id,check_in_at,check_out_at`),
  ]);
  const hours = (id: string) =>
    shifts
      .filter((s) => s.teacher_id === id && s.check_out_at)
      .reduce((h, s) => h + (new Date(s.check_out_at!).getTime() - new Date(s.check_in_at).getTime()) / 3600000, 0);

  return (
    <>
      <div className="adm-head"><h1>老師</h1></div>
      <ul className="adm-list">
        {teachers.map((t) => {
          const last = shifts.find((s) => s.teacher_id === t.id);
          return (
            <li key={t.id} className={`adm-panel ${t.active ? "" : "muted"}`}>
              <form action={updateTeacher} className="adm-grid">
                <input type="hidden" name="id" value={t.id} />
                <div className="field"><label>姓名</label><input name="name" defaultValue={t.name} required /></div>
                <div className="field"><label>稱呼</label><input name="nickname" defaultValue={t.nickname ?? ""} /></div>
                <div className="field"><label>手機</label><input name="phone" defaultValue={t.phone ?? ""} /></div>
                <div className="field">
                  <label>登入 Email</label>
                  <input value={t.email ?? "（未設定）"} readOnly />
                  <small>{t.auth_user_id ? "已登入過" : "尚未登入過"}・卡片 {t.cards.filter((c) => !c.revoked_at).length} 張</small>
                </div>
                <label className="adm-check"><input type="checkbox" name="is_admin" defaultChecked={t.is_admin} disabled={t.id === me.id} /> 管理員</label>
                <label className="adm-check"><input type="checkbox" name="active" defaultChecked={t.active} disabled={t.id === me.id} /> 在職</label>
                {t.id === me.id && <><input type="hidden" name="is_admin" value="on" /><input type="hidden" name="active" value="on" /></>}
                <div className="adm-wide adm-btns">
                  <button className="btn btn-sm" type="submit">儲存</button>
                  <small className="hint">
                    近 7 天刷卡上課 {hours(t.id).toFixed(1)} 小時
                    {last && `・最近一次 ${fmtDateTime(last.check_in_at)}${last.check_out_at ? "" : "（尚未下班）"}`}
                  </small>
                </div>
              </form>
            </li>
          );
        })}
      </ul>
      <NewTeacherForm />
      <p className="hint">老師刷卡上下班：到「卡片」頁把卡綁給老師即可。停用老師後，他就無法登入，卡片也不能刷。</p>
    </>
  );
}

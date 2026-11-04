import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet } from "@/lib/supabase";
import { LEVEL_NAME, LEVEL_OPTIONS, MAJOR_NAME, fmtDateTime, ymd } from "@/lib/admin";
import { PHOTO_SCOPE_LABEL } from "@/lib/consent";
import { approveRegistration, rejectRegistration } from "../actions";

export const metadata = { title: "報名資料" };

type Req = {
  id: string; status: string; child_name: string; child_nickname: string; child_level: string;
  child_birth_year: number | null; child_gender: string | null; child_school: string | null; interests: string[];
  guardian_name: string; guardian_relation: string | null; guardian_phone: string; guardian_email: string | null;
  pickup_name: string | null; pickup_relation: string | null; pickup_phone: string | null;
  consent_version: string; consent_at: string; photo_scope: string; marketing_consent: boolean;
  care_notes: string | null; message: string | null; review_note: string | null; reviewed_at: string | null;
  student_id: string | null; created_at: string; teachers: { name: string } | null;
};

export default async function RegistrationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const rows = await sbGet<Req[]>(`registration_requests?id=eq.${id}&select=*,teachers(name)`);
  const r = rows[0];
  if (!r) notFound();

  // 可能重複：同電話的家長、同名的學生
  const [sameGuardian, sameChild, classes] = await Promise.all([
    sbGet<{ id: string; name: string; student_guardians: { students: { id: string; nickname: string; name: string } }[] }[]>(
      `guardians?phone=eq.${encodeURIComponent(r.guardian_phone)}&select=id,name,student_guardians(students(id,nickname,name))`,
    ),
    sbGet<{ id: string; nickname: string; name: string }[]>(`students?name=eq.${encodeURIComponent(r.child_name)}&select=id,nickname,name`),
    sbGet<{ id: string; name: string }[]>(`classes?or=(ends_on.is.null,ends_on.gte.${ymd()})&order=name&select=id,name`),
  ]);
  const siblings = sameGuardian.flatMap((g) => g.student_guardians.map((sg) => sg.students));

  const Item = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div><dt>{k}</dt><dd>{v || "—"}</dd></div>
  );

  return (
    <>
      <div className="adm-head">
        <h1>{r.child_name} <small>線上報名・{fmtDateTime(r.created_at)}</small></h1>
        <Link href="/admin/registrations" className="adm-link">← 回報名列表</Link>
      </div>

      {r.status !== "pending" && (
        <p className={`notice ${r.status === "approved" ? "ok" : "err"}`}>
          {r.status === "approved" ? "已建檔" : "已標記為不建檔"}（{r.teachers?.name}，{r.reviewed_at && fmtDateTime(r.reviewed_at)}）
          {r.student_id && <> <Link href={`/admin/students/${r.student_id}`}>查看學生資料 →</Link></>}
          {r.review_note && <><br />備註：{r.review_note}</>}
        </p>
      )}
      {sameChild.length > 0 && (
        <p className="notice err">
          系統裡已有同名學生：{sameChild.map((s) => <Link key={s.id} href={`/admin/students/${s.id}`}>{s.nickname}（{s.name}）</Link>)}。請確認是不是重複報名。
        </p>
      )}

      <div className="adm-cols">
        <section className="adm-panel">
          <h2>報名內容</h2>
          <dl className="adm-dl">
            <Item k="孩子姓名" v={r.child_name} />
            <Item k="角色暱稱" v={r.child_nickname} />
            <Item k="階段" v={LEVEL_NAME[r.child_level]} />
            <Item k="出生年" v={r.child_birth_year} />
            <Item k="性別" v={r.child_gender} />
            <Item k="學校" v={r.child_school} />
            <Item k="有興趣" v={r.interests.map((m) => MAJOR_NAME[m]).join("、")} />
            <Item k="家長" v={`${r.guardian_name}${r.guardian_relation ? `（${r.guardian_relation}）` : ""}`} />
            <Item k="手機" v={<a href={`tel:${r.guardian_phone}`}>{r.guardian_phone}</a>} />
            <Item k="Email" v={r.guardian_email} />
            <Item k="其他接送人" v={r.pickup_name && `${r.pickup_name}${r.pickup_relation ? `（${r.pickup_relation}）` : ""} ${r.pickup_phone ?? ""}`} />
            <Item k="照片公開" v={PHOTO_SCOPE_LABEL[r.photo_scope]} />
            <Item k="課程訊息" v={r.marketing_consent ? "願意收到" : "不需要"} />
            <Item k="照護注意事項" v={r.care_notes && <strong className="adm-warn">⚠ {r.care_notes}（家長已勾選同意記錄）</strong>} />
            <Item k="家長留言" v={r.message} />
            <Item k="個資同意" v={`${fmtDateTime(r.consent_at)}，線上勾選（版本 ${r.consent_version}）`} />
          </dl>
          {siblings.length > 0 && (
            <p className="hint">
              這支電話已登記過，建檔時會連到同一位家長（{sameGuardian[0].name}）。已有的孩子：
              {siblings.map((s) => <Link key={s.id} href={`/admin/students/${s.id}`}> {s.nickname}</Link>)}
            </p>
          )}
        </section>

        {r.status === "pending" && (
          <div>
            <form action={approveRegistration} className="adm-panel adm-form">
              <h2>確認並建檔</h2>
              <input type="hidden" name="id" value={r.id} />
              <div className="adm-grid">
                <div className="field">
                  <label htmlFor="nickname">角色暱稱</label>
                  <input id="nickname" name="nickname" defaultValue={r.child_nickname} maxLength={20} required />
                  <small>暱稱不適合（例如用了全名）可以在這裡改</small>
                </div>
                <div className="field">
                  <label htmlFor="level">階段</label>
                  <select id="level" name="level" defaultValue={r.child_level}>
                    {LEVEL_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div className="field adm-wide">
                  <label htmlFor="class_id">同時加入班級（選填）</label>
                  <select id="class_id" name="class_id" defaultValue="">
                    <option value="">先不加入</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="field adm-wide">
                  <label htmlFor="review_note">備註（選填）</label>
                  <input id="review_note" name="review_note" maxLength={300} />
                </div>
              </div>
              <p className="hint">建檔後請在家長第一次到教室時，補簽紙本個資同意書。</p>
              <button className="btn primary" type="submit">建檔（建立學生與遊戲角色）</button>
            </form>
            <form action={rejectRegistration} className="adm-panel adm-form">
              <h2>不建檔</h2>
              <p className="hint">重複報名、測試資料或家長取消時使用。資料會保留，之後依保存期限刪除。</p>
              <input type="hidden" name="id" value={r.id} />
              <div className="field"><label htmlFor="rej_note">原因</label><input id="rej_note" name="review_note" maxLength={300} /></div>
              <button className="btn btn-sm" type="submit">標記為不建檔</button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}

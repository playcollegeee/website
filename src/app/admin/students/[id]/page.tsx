import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet } from "@/lib/supabase";
import { recentUnknownUids } from "@/lib/unknownCards";
import { ATT_LABEL, LEVEL_NAME, RELATIONS, TRACK_NAME, fmtDate, fmtDateTime, fmtTime, ymd } from "@/lib/admin";
import {
  addGuardian, bindCard, enrollStudent, revokeCard, setEnrollmentStatus, unlinkGuardian, updateGuardian, updateStudent,
} from "../actions";
import StudentFields from "../StudentFields";
import GuardianFields from "../GuardianFields";
import ConsentFields from "../ConsentFields";

export const metadata = { title: "學生資料" };

type Student = {
  id: string; name: string; nickname: string; level: string; birth_year: number | null; gender: string | null;
  school: string | null; notes: string | null; active: boolean; photo_consent: boolean; consent_at: string | null;
  photo_scope: string; care_notes: string | null; care_consent_at: string | null;
  consent_method: string | null; consent_version: string | null; created_at: string;
  student_guardians: {
    relation: string | null; is_primary: boolean; can_pickup: boolean;
    guardians: { id: string; name: string; phone: string | null; email: string | null; note: string | null };
  }[];
  cards: { uid: string; kind: string; label: string | null; issued_at: string; revoked_at: string | null }[];
  enrollments: { status: string; classes: { id: string; name: string } }[];
  avatar_xp: { track: string; xp: number }[];
  student_items: { obtained_at: string; items: { name: string; slot: string; rarity: string } }[];
};
type Att = { status: string; checked_in_at: string | null; source: string; sessions: { starts_at: string; classes: { name: string } } };

export default async function StudentPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; saved?: string }> }) {
  await requireStaff();
  const { id } = await params;
  const { created, saved } = await searchParams;
  if (!isUuid(id)) notFound();

  const [rows, atts, classes, unknown] = await Promise.all([
    sbGet<Student[]>(
      `students?id=eq.${id}&select=*,student_guardians(relation,is_primary,can_pickup,guardians(id,name,phone,email,note)),` +
        `cards(uid,kind,label,issued_at,revoked_at),enrollments(status,classes(id,name)),avatar_xp(track,xp),` +
        `student_items(obtained_at,items(name,slot,rarity))`,
    ),
    sbGet<Att[]>(`attendance?student_id=eq.${id}&order=created_at.desc&limit=30&select=status,checked_in_at,source,sessions(starts_at,classes(name))`),
    sbGet<{ id: string; name: string }[]>(`classes?or=(ends_on.is.null,ends_on.gte.${ymd()})&order=name&select=id,name`),
    recentUnknownUids(),
  ]);
  const s = rows[0];
  if (!s) notFound();
  const enrolledIds = new Set(s.enrollments.map((e) => e.classes.id));
  const back = `/admin/students/${id}`;
  const guardians = [...s.student_guardians].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

  return (
    <>
      <div className="adm-head">
        <h1>{s.nickname} <small>{s.name}・{LEVEL_NAME[s.level]}</small></h1>
        <Link href="/admin/students" className="adm-link">← 回學生列表</Link>
      </div>
      {created && <p className="notice ok">已建立學生，也自動建立了遊戲角色。下一步：綁定卡片、加入班級。</p>}
      {saved && <p className="notice ok">已儲存。</p>}
      {s.care_notes && <p className="notice err">⚠ 照護注意事項：{s.care_notes}</p>}
      {!s.active && <p className="notice err">這位學生已設為「離開」，讀卡站不會讓他簽到。</p>}

      <div className="adm-cols">
        <div>
          {/* ---------- 角色 ---------- */}
          <section className="adm-panel adm-hero">
            <h2>遊戲角色</h2>
            <div className="adm-xp">
              {Object.entries(TRACK_NAME).map(([track, label]) => {
                const xp = s.avatar_xp.find((x) => x.track === track)?.xp ?? 0;
                return (
                  <div key={track} className={`adm-xp-${track === "3d" ? "print" : track}`}>
                    <span>{label}</span>
                    <strong>{xp}</strong>
                    <small>經驗值</small>
                  </div>
                );
              })}
            </div>
            {s.student_items.length > 0 ? (
              <ul className="adm-items">
                {s.student_items.map((it) => (
                  <li key={it.items.name + it.obtained_at} title={`${fmtDate(it.obtained_at)} 取得`}>{it.items.name}</li>
                ))}
              </ul>
            ) : (
              <p className="hint">還沒有裝備。上課簽到後，會依當堂教案自動發放。</p>
            )}
          </section>

          {/* ---------- 班級 ---------- */}
          <section className="adm-panel">
            <h2>班級</h2>
            {s.enrollments.length === 0 && <p className="hint">還沒有加入任何班級。</p>}
            <ul className="adm-rows">
              {s.enrollments.map((e) => (
                <li key={e.classes.id}>
                  <Link href={`/admin/classes/${e.classes.id}`}>{e.classes.name}</Link>
                  <span className={`tag ${e.status === "active" ? "tag-green" : "tag-gray"}`}>
                    {{ active: "上課中", cancelled: "已退出", completed: "已結業", waitlist: "候補" }[e.status] ?? e.status}
                  </span>
                  <form action={setEnrollmentStatus}>
                    <input type="hidden" name="student_id" value={id} />
                    <input type="hidden" name="class_id" value={e.classes.id} />
                    <input type="hidden" name="status" value={e.status === "active" ? "cancelled" : "active"} />
                    <button className="adm-link" type="submit">{e.status === "active" ? "退出這班" : "恢復"}</button>
                  </form>
                </li>
              ))}
            </ul>
            {classes.some((c) => !enrolledIds.has(c.id)) && (
              <form action={enrollStudent} className="adm-inline-form">
                <input type="hidden" name="student_id" value={id} />
                <select name="class_id" required defaultValue="" aria-label="選擇班級">
                  <option value="" disabled>選擇班級…</option>
                  {classes.filter((c) => !enrolledIds.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className="btn btn-sm" type="submit">加入</button>
              </form>
            )}
          </section>

          {/* ---------- 卡片 ---------- */}
          <section className="adm-panel">
            <h2>簽到卡</h2>
            <ul className="adm-rows">
              {s.cards.map((c) => (
                <li key={c.uid} className={c.revoked_at ? "muted" : ""}>
                  <code>{c.uid}</code>
                  <span>{c.kind === "qr" ? "QR" : "NFC"}{c.label && `・${c.label}`}</span>
                  {c.revoked_at ? (
                    <span className="tag tag-gray">已停用</span>
                  ) : (
                    <form action={revokeCard}>
                      <input type="hidden" name="uid" value={c.uid} />
                      <input type="hidden" name="back" value={back} />
                      <button className="adm-link danger" type="submit">停用（遺失）</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <form action={bindCard} className="adm-inline-form">
              <input type="hidden" name="owner" value={`student:${id}`} />
              <input type="hidden" name="back" value={back} />
              <input name="uid" list="unknown-uids" required placeholder="卡號" aria-label="卡號" />
              <datalist id="unknown-uids">
                {unknown.map((u) => <option key={u.uid} value={u.uid}>{fmtTime(u.at)} 刷過</option>)}
              </datalist>
              <input name="label" placeholder="備註（例：藍色手環）" aria-label="備註" maxLength={30} />
              <button className="btn btn-sm" type="submit">綁定</button>
            </form>
            <p className="hint">
              綁新卡：先把卡片在讀卡站刷一下（會顯示「未登記」），再回來點卡號欄位，選最近刷過的卡號。
            </p>
          </section>

          {/* ---------- 出席 ---------- */}
          <section className="adm-panel">
            <h2>最近出席</h2>
            {atts.length === 0 ? (
              <p className="hint">還沒有上課紀錄。</p>
            ) : (
              <table className="adm-table">
                <tbody>
                  {atts.map((a, i) => (
                    <tr key={i}>
                      <td>{fmtDate(a.sessions.starts_at)}</td>
                      <td>{a.sessions.classes.name}</td>
                      <td>{ATT_LABEL[a.status]}{a.checked_in_at && <small> {fmtTime(a.checked_in_at)}{a.source === "card" ? " 刷卡" : ""}</small>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <div>
          {/* ---------- 家長 ---------- */}
          <section className="adm-panel">
            <h2>家長與聯絡人</h2>
            {guardians.map((g) => (
              <details key={g.guardians.id} className="adm-guardian">
                <summary>
                  <strong>{g.guardians.name}</strong>
                  {g.relation && <span>（{g.relation}）</span>}
                  {g.is_primary && <span className="tag tag-yellow">主要聯絡人</span>}
                  <a href={`tel:${g.guardians.phone ?? ""}`}>{g.guardians.phone}</a>
                </summary>
                <form action={updateGuardian} className="adm-grid">
                  <input type="hidden" name="student_id" value={id} />
                  <input type="hidden" name="guardian_id" value={g.guardians.id} />
                  <div className="field"><label>姓名</label><input name="name" required defaultValue={g.guardians.name} /></div>
                  <div className="field">
                    <label>關係</label>
                    <select name="relation" defaultValue={g.relation ?? "其他"}>{RELATIONS.map((r) => <option key={r}>{r}</option>)}</select>
                  </div>
                  <div className="field"><label>手機</label><input name="phone" required type="tel" defaultValue={g.guardians.phone ?? ""} /></div>
                  <div className="field"><label>Email</label><input name="email" type="email" defaultValue={g.guardians.email ?? ""} /></div>
                  <div className="field adm-wide"><label>備註</label><input name="note" defaultValue={g.guardians.note ?? ""} /></div>
                  <label className="adm-check"><input type="checkbox" name="can_pickup" defaultChecked={g.can_pickup} /> 可接送</label>
                  <label className="adm-check"><input type="checkbox" name="is_primary" defaultChecked={g.is_primary} /> 主要聯絡人</label>
                  <div className="adm-wide adm-btns">
                    <button className="btn btn-sm" type="submit">儲存聯絡人</button>
                  </div>
                </form>
                {guardians.length > 1 && (
                  <form action={unlinkGuardian}>
                    <input type="hidden" name="student_id" value={id} />
                    <input type="hidden" name="guardian_id" value={g.guardians.id} />
                    <button className="adm-link danger" type="submit">從這位學生移除</button>
                  </form>
                )}
              </details>
            ))}
            <details className="adm-add">
              <summary>＋ 新增聯絡人（爸爸、阿嬤…）</summary>
              <form action={addGuardian}>
                <input type="hidden" name="student_id" value={id} />
                <GuardianFields />
                <label className="adm-check"><input type="checkbox" name="can_pickup" defaultChecked /> 可接送</label>
                <button className="btn btn-sm" type="submit">新增</button>
              </form>
            </details>
          </section>

          {/* ---------- 基本資料 ---------- */}
          <section className="adm-panel">
            <h2>基本資料</h2>
            <form action={updateStudent}>
              <input type="hidden" name="id" value={id} />
              <StudentFields v={s} />
              <ConsentFields photoScope={s.photo_scope} careNotes={s.care_notes} careConsented={!!s.care_consent_at} />
              <label className="adm-check"><input type="checkbox" name="active" defaultChecked={s.active} /> 在學中（取消勾選＝離開，資料保留）</label>
              <p className="hint">
                個資同意：{s.consent_at ? `${fmtDateTime(s.consent_at)}，${s.consent_method === "online" ? "線上報名" : "紙本"}（版本 ${s.consent_version}）` : "未紀錄"}
              </p>
              <button className="btn btn-sm primary" type="submit">儲存基本資料</button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}

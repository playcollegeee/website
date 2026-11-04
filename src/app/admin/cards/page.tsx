import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import { recentUnknownUids } from "@/lib/unknownCards";
import { fmtDate, fmtDateTime, fmtTime, normalizeUid } from "@/lib/admin";
import { bindCard, revokeCard } from "../students/actions";

export const metadata = { title: "卡片" };

type Card = {
  uid: string; kind: string; label: string | null; issued_at: string;
  students: { id: string; nickname: string; name: string } | null;
  teachers: { id: string; name: string } | null;
};

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ uid?: string }> }) {
  const staff = await requireStaff();
  const { uid } = await searchParams;
  const [cards, unknown, students, teachers] = await Promise.all([
    sbGet<Card[]>("cards?revoked_at=is.null&order=issued_at.desc&select=uid,kind,label,issued_at,students(id,nickname,name),teachers(id,name)"),
    recentUnknownUids(10),
    sbGet<{ id: string; nickname: string; name: string }[]>("students?active=eq.true&order=nickname&select=id,nickname,name"),
    staff.is_admin ? sbGet<{ id: string; name: string }[]>("teachers?active=eq.true&order=name&select=id,name") : Promise.resolve([]),
  ]);
  const preset = uid ? normalizeUid(uid) : unknown[0]?.uid ?? "";

  return (
    <>
      <div className="adm-head"><h1>卡片</h1></div>

      <form action={bindCard} className="adm-panel adm-form">
        <h2>綁定新卡</h2>
        <ol className="adm-steps">
          <li>把新卡在讀卡站刷一下，畫面會顯示「這張卡還沒登記」。</li>
          <li>回到這頁（重新整理），卡號會出現在下面，選擇持卡人後按「綁定」。</li>
        </ol>
        <div className="adm-grid">
          <div className="field">
            <label htmlFor="uid">卡號 *</label>
            <input id="uid" name="uid" required defaultValue={preset} list="unknown-uids" autoComplete="off" />
            <datalist id="unknown-uids">
              {unknown.map((u) => <option key={u.uid} value={u.uid}>{fmtDate(u.at)} {fmtTime(u.at)} 刷過</option>)}
            </datalist>
            {unknown.length > 0 && <small>最近刷過、還沒登記的卡：{unknown.map((u) => u.uid).join("、")}</small>}
          </div>
          <div className="field">
            <label htmlFor="owner">持卡人 *</label>
            <select id="owner" name="owner" required defaultValue="">
              <option value="" disabled>請選擇</option>
              <optgroup label="學生">
                {students.map((s) => <option key={s.id} value={`student:${s.id}`}>{s.nickname}（{s.name}）</option>)}
              </optgroup>
              {teachers.length > 0 && (
                <optgroup label="老師">
                  {teachers.map((t) => <option key={t.id} value={`teacher:${t.id}`}>{t.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          <div className="field">
            <label htmlFor="kind">卡片類型</label>
            <select id="kind" name="kind" defaultValue="nfc">
              <option value="nfc">NFC 卡／手環</option>
              <option value="qr">QR 卡</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="label">備註</label>
            <input id="label" name="label" maxLength={30} placeholder="例：藍色手環、備用卡" />
          </div>
        </div>
        <input type="hidden" name="back" value="/admin/cards" />
        <button className="btn primary" type="submit">綁定</button>
      </form>

      <section className="adm-panel">
        <h2>使用中的卡片 <small>{cards.length} 張</small></h2>
        {cards.length === 0 ? (
          <p className="adm-empty">還沒有綁定任何卡片。</p>
        ) : (
          <div className="adm-scroll">
            <table className="adm-table">
              <thead><tr><th>卡號</th><th>持卡人</th><th>類型</th><th>綁定時間</th><th /></tr></thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.uid}>
                    <td><code>{c.uid}</code></td>
                    <td>
                      {c.students ? <Link href={`/admin/students/${c.students.id}`}>{c.students.nickname}（{c.students.name}）</Link>
                        : c.teachers ? <>{c.teachers.name} <span className="tag tag-blue">老師</span></> : "—"}
                    </td>
                    <td>{c.kind === "qr" ? "QR" : "NFC"}{c.label && `・${c.label}`}</td>
                    <td>{fmtDateTime(c.issued_at)}</td>
                    <td>
                      {(c.students || staff.is_admin) && (
                        <form action={revokeCard}>
                          <input type="hidden" name="uid" value={c.uid} />
                          <button className="adm-link danger" type="submit">停用</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">卡片遺失就按「停用」，之後有人撿到也不能拿來簽到。停用的卡號可以再綁給別人。</p>
      </section>
    </>
  );
}

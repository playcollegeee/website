import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet } from "@/lib/supabase";
import { BOOKING_STATUS_LABEL, gradeLabel, money, runTitle, type Booking, type BookingPerson, type Run, type Theme } from "@/lib/events";
import ActBtn from "../../events/ActBtn";
import { deleteFamily } from "../actions";
import { loadContacts } from "../data";
import FamilyForms from "./FamilyForms";

export const metadata = { title: "名單詳細" };

// 後台：一個家庭（聯絡人、孩子／成人、標籤、報名紀錄）
export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(true);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { rows, tags } = await loadContacts(id);
  const family = rows[0]?.family ?? (await sbGet<import("@/lib/eventTypes").Family[]>(`contact_families?id=eq.${id}&select=*`))[0];
  if (!family) notFound();
  const bookings = await sbGet<Booking[]>(`activity_bookings?family_id=eq.${id}&select=*&order=created_at.desc`);
  const ids = bookings.map((b) => b.id);
  const [people, runs] = await Promise.all([
    ids.length ? sbGet<BookingPerson[]>(`activity_booking_people?booking_id=in.(${ids.join(",")})&select=*`) : Promise.resolve([] as BookingPerson[]),
    ids.length ? sbGet<Run[]>(`activity_runs?id=in.(${[...new Set(bookings.map((b) => b.run_id))].join(",")})&select=*`) : Promise.resolve([] as Run[]),
  ]);
  const themes = runs.length ? await sbGet<Theme[]>(`activity_themes?id=in.(${[...new Set(runs.map((r) => r.theme_id))].join(",")})&select=*`) : [];

  return (
    <>
      <p className="hint"><Link href="/admin/contacts">← 活動名單</Link></p>
      <h1>{family.name} 的家庭</h1>
      <FamilyForms
        family={family}
        tags={tags}
        people={rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, gradeNow: r.gradeNow, gradeText: r.gradeText, stage: r.stage, note: r.note, manual: r.manual.map((t) => t.id), auto: [...r.series, ...r.themes, ...r.areas, ...(r.returning ? ["舊生"] : [])] }))}
      />
      <h2 className="ph-h">報名紀錄（{bookings.length}）</h2>
      <div className="adm-scroll">
        <table className="adm-table">
          <thead><tr><th>日期</th><th>活動</th><th>參加者</th><th>金額</th><th>狀態</th></tr></thead>
          <tbody>
            {bookings.map((b) => {
              const run = runs.find((r) => r.id === b.run_id);
              const theme = themes.find((t) => t.id === run?.theme_id);
              return (
                <tr key={b.id}>
                  <td>{b.created_at.slice(0, 10)}</td>
                  <td>{run && theme ? <Link href={`/admin/events/runs/${run.id}`}>{runTitle(run, theme)}</Link> : ""}<div className="hint">{b.code}</div></td>
                  <td>{people.filter((p) => p.booking_id === b.id).map((p) => `${p.name}${p.grade !== null ? `（${gradeLabel(p.grade)}）` : ""}`).join("、")}</td>
                  <td>${money(b.amount)}</td>
                  <td>{BOOKING_STATUS_LABEL[b.status]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint ev-danger-zone">
        家長要求刪除個資時：
        <ActBtn run={deleteFamily.bind(null, family.id)} label="刪除這個家庭的名單資料" className="adm-link danger" ask="刪除後無法復原（報名紀錄的帳務資料依稅法保留），確定？" />
      </p>
    </>
  );
}

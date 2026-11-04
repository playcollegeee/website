import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import { LEVEL_NAME, fmtDateTime } from "@/lib/admin";

export const metadata = { title: "線上報名" };

type Row = {
  id: string; status: string; child_name: string; child_nickname: string; child_level: string;
  guardian_name: string; guardian_phone: string; care_notes: string | null; created_at: string;
};
const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "待審核", color: "red" },
  approved: { label: "已建檔", color: "green" },
  rejected: { label: "不建檔", color: "gray" },
};

export default async function RegistrationsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await requireStaff();
  const { all } = await searchParams;
  const rows = await sbGet<Row[]>(
    `registration_requests?order=created_at.desc&limit=200${all ? "" : "&status=eq.pending"}` +
      `&select=id,status,child_name,child_nickname,child_level,guardian_name,guardian_phone,care_notes,created_at`,
  );
  return (
    <>
      <div className="adm-head">
        <h1>線上報名 <small>{all ? "全部" : `待審核 ${rows.length} 筆`}</small></h1>
        <div className="adm-actions">
          <Link className="btn btn-sm" href={all ? "/admin/registrations" : "/admin/registrations?all=1"}>{all ? "只看待審核" : "看全部"}</Link>
        </div>
      </div>
      <p className="hint">家長在官網 <a href="/enroll" target="_blank">playcollegeee.com/enroll</a> 填寫。確認後按「建檔」，系統會建立家長、學生與遊戲角色。</p>
      {rows.length === 0 ? (
        <p className="adm-empty">{all ? "還沒有線上報名。" : "目前沒有待審核的報名。"}</p>
      ) : (
        <div className="adm-scroll">
          <table className="adm-table">
            <thead><tr><th>送出時間</th><th>孩子</th><th>階段</th><th>家長</th><th>狀態</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDateTime(r.created_at)}</td>
                  <td>
                    <Link className="adm-strong" href={`/admin/registrations/${r.id}`}>{r.child_name}</Link>
                    <small>（{r.child_nickname}）</small>
                    {r.care_notes && <span className="tag tag-red">照護注意</span>}
                  </td>
                  <td>{LEVEL_NAME[r.child_level]}</td>
                  <td>{r.guardian_name}<br /><small>{r.guardian_phone}</small></td>
                  <td><span className={`tag tag-${STATUS[r.status]?.color}`}>{STATUS[r.status]?.label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

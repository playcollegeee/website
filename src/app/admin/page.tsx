import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { sbFetch, supabaseConfig } from "@/lib/supabase";
import { levels, majors } from "@/lib/content";
import { LEAD_STATUSES, LEAD_TYPES } from "./labels";
import { updateLeadStatus } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "詢問後台", robots: { index: false, follow: false } };

type Lead = {
  id: string;
  type: string;
  guardian_name: string;
  phone: string;
  email: string | null;
  child_level: string | null;
  interests: string[];
  message: string | null;
  status: string;
  created_at: string;
};

const levelName = (slug: string | null) => levels.find((l) => l.slug === slug)?.name ?? "未填";
const majorName = (slug: string) => majors.find((m) => m.slug === slug)?.short ?? slug;
const fmt = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  // 第二道檢查：就算 proxy 沒擋到，沒登入一律看不到
  const h = await headers();
  if (!isAdminAuthorized(h.get("authorization"))) notFound();

  const { status } = await searchParams;
  const filter = LEAD_STATUSES.some((s) => s.value === status) ? status : undefined;

  let leads: Lead[] = [];
  let error = "";
  if (!supabaseConfig()) {
    error = "Supabase 尚未設定";
  } else {
    const q = new URLSearchParams({ select: "*", order: "created_at.desc", limit: "300" });
    const res = await sbFetch(`leads?${q}`);
    if (res.ok) leads = (await res.json()) as Lead[];
    else error = `讀取失敗（${res.status}）`;
  }

  // 各狀態筆數（用來顯示在篩選按鈕上）
  const counts: Record<string, number> = {};
  for (const l of leads) counts[l.status] = (counts[l.status] ?? 0) + 1;
  const shown = filter ? leads.filter((l) => l.status === filter) : leads;

  return (
    <section className="section admin">
      <div className="container">
        <div className="admin-head">
          <h1>詢問後台</h1>
          <p className="hint">官網表單送來的詢問，最新的在最上面。打完電話記得把狀態改掉。</p>
        </div>

        <nav className="admin-filter" aria-label="依狀態篩選">
          <Link href="/admin" className={!filter ? "on" : ""}>
            全部 <b>{leads.length}</b>
          </Link>
          {LEAD_STATUSES.map((s) => (
            <Link key={s.value} href={`/admin?status=${s.value}`} className={filter === s.value ? "on" : ""}>
              {s.label} <b>{counts[s.value] ?? 0}</b>
            </Link>
          ))}
        </nav>

        {error && <div className="notice err">{error}</div>}
        {!error && shown.length === 0 && <p className="admin-empty">目前沒有這個狀態的詢問。</p>}

        <ul className="admin-list">
          {shown.map((l) => {
            const st = LEAD_STATUSES.find((s) => s.value === l.status);
            return (
              <li key={l.id} className="admin-card">
                <div className="admin-card-top">
                  <span className={`tag tag-${st?.color ?? "gray"}`}>{st?.label ?? l.status}</span>
                  <span className="admin-type">{LEAD_TYPES[l.type] ?? l.type}</span>
                  <time className="admin-time" dateTime={l.created_at}>
                    {fmt.format(new Date(l.created_at))}
                  </time>
                </div>
                <div className="admin-who">
                  <strong>{l.guardian_name}</strong>
                  <a href={`tel:${l.phone.replace(/[^0-9+]/g, "")}`}>{l.phone}</a>
                  {l.email && <a href={`mailto:${l.email}`}>{l.email}</a>}
                </div>
                <dl className="admin-meta">
                  <div>
                    <dt>孩子年級</dt>
                    <dd>{levelName(l.child_level)}</dd>
                  </div>
                  <div>
                    <dt>有興趣</dt>
                    <dd>{l.interests.length ? l.interests.map(majorName).join("、") : "未填"}</dd>
                  </div>
                </dl>
                {l.message && <p className="admin-msg">{l.message}</p>}
                <form action={updateLeadStatus} className="admin-status">
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="from" value={l.status} />
                  <label>
                    <span className="sr-only">狀態</span>
                    <select name="status" defaultValue={l.status}>
                      {LEAD_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="btn btn-sm">
                    更新狀態
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

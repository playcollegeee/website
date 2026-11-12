import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet } from "@/lib/supabase";
import { canEditPlan } from "@/lib/plans";
import { canModerate } from "@/lib/board";
import Board from "./Board";
import Helpers from "./Helpers";

export const metadata = { title: "討論白板" };

type T = { id: string; name: string; nickname: string | null };
type M = {
  id: string; title: string; held_on: string | null; plan_id: string | null; created_by: string | null;
  plan: { id: string; title: string; theme: string | null; owner_id: string | null; created_by: string | null } | null;
  helpers: { teacher_id: string }[];
};

// 會議討論白板：一場會議一塊。之後的行政會議也共用這一頁（會議不一定掛在課程規劃底下）。
export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [rows, teachers] = await Promise.all([
    sbGet<M[]>(
      `meetings?id=eq.${id}&select=id,title,held_on,plan_id,created_by,plan:plans(id,title,theme,owner_id,created_by),helpers:meeting_helpers(teacher_id)`,
    ).catch(() => null),
    sbGet<T[]>("teachers?select=id,name,nickname,active&order=name"),
  ]);
  if (rows === null) {
    return (
      <div className="adm-panel">
        <h1>討論白板</h1>
        <p className="notice err">白板還沒啟用：請管理員到 Supabase 執行 migration 0018（會議討論白板）。</p>
      </div>
    );
  }
  const m = rows[0];
  if (!m) notFound();
  const helperIds = m.helpers.map((h) => h.teacher_id);
  // 小幫手由會議建立者、規劃負責人或管理員設定
  const canSetHelpers = staff.is_admin || m.created_by === staff.id || (m.plan ? canEditPlan(m.plan, staff) : false);
  const active = (teachers as (T & { active?: boolean })[]).filter((t) => t.active !== false);
  const back = m.plan ? { href: `/admin/plans/${m.plan.id}`, label: `回到「${m.plan.theme || m.plan.title}」` } : { href: "/admin", label: "回到後台" };

  return (
    <div className="bd-page">
      <p><Link href={back.href} className="adm-link">← {back.label}</Link></p>
      <div className="bd-head">
        <h1>🧩 {m.title}{m.held_on ? <small className="muted">　{m.held_on.slice(5).replace("-", "/")}</small> : null}</h1>
        <Helpers
          meetingId={m.id}
          teachers={active}
          helperIds={helperIds}
          creatorId={m.created_by}
          canSet={canSetHelpers}
          mod={canModerate(m, helperIds, staff)}
        />
      </div>
      <Board meetingId={m.id} me={staff.id} teachers={teachers} title={m.title} />
    </div>
  );
}

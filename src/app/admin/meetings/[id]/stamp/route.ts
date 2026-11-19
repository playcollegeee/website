import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getStaff } from "@/lib/staff";
import { isUuid, sbGet } from "@/lib/supabase";

// 會議室自動更新：回傳這頁資料（白板以外）的「指紋」。
// 瀏覽器每幾秒問一次，指紋變了才重新整理頁面，平常只讀幾個小欄位，不會拖慢資料庫。
// 白板有自己的同步（board/sync），這裡不算白板。參考網址及檔案也算在內（0024）。
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: "請重新登入" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "資料不正確" }, { status: 400 });

  try {
    const rows = await sbGet<{ plan_id: string | null }[]>(
      `meetings?id=eq.${id}&select=plan_id,title,held_on,status,updated_at,applied_at,parts_total,parts:meeting_parts(count),helpers:meeting_helpers(teacher_id)`,
    );
    if (!rows[0]) return NextResponse.json({ error: "找不到這場會議" }, { status: 404 });
    const pid = rows[0].plan_id;
    const parts = await Promise.all([
      sbGet(`meeting_agenda?meeting_id=eq.${id}&select=id,updated_at,seq,owner_id&order=id`).catch(() => null),
      ...(pid
        ? [
            sbGet(`plans?id=eq.${pid}&select=updated_at,theme,status`),
            sbGet(`plan_items?plan_id=eq.${pid}&select=id,updated_at&order=id`),
            sbGet(`plan_comments?plan_id=eq.${pid}&select=id,updated_at,is_decision,decided_at&order=id`),
            sbGet(`plan_tasks?plan_id=eq.${pid}&select=id,done_at,title,due_date,assignee_id,assignee_ids&order=id`).catch(() => sbGet(`plan_tasks?plan_id=eq.${pid}&select=id,done_at,title,due_date,assignee_id&order=id`)),
            sbGet(`plan_refs?plan_id=eq.${pid}&select=id&order=id`).catch(() => null),
            sbGet(`plan_ideas?plan_id=eq.${pid}&select=id,updated_at,status,votes:plan_votes(teacher_id)&order=id`).catch(() => null),
          ]
        : []),
    ]);
    const stamp = createHash("sha1").update(JSON.stringify([rows, parts])).digest("hex").slice(0, 16);
    return NextResponse.json({ stamp }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "讀取失敗" }, { status: 502 });
  }
}

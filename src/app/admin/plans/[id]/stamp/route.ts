import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getStaff } from "@/lib/staff";
import { isUuid, sbGet } from "@/lib/supabase";

// 課程規劃頁自動更新：回傳這頁資料的「指紋」（規劃、時程、留言與決議、待辦、點子與投票、會議與議程）。
// 瀏覽器每幾秒問一次，指紋變了才重新整理（例：別的老師按了「安排會議」，其他人幾秒內就看到）。
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: "請重新登入" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "資料不正確" }, { status: 400 });

  try {
    const parts = await Promise.all([
      sbGet(`plans?id=eq.${id}&select=updated_at,theme,status,title`),
      sbGet(`plan_items?plan_id=eq.${id}&select=id,updated_at&order=id`),
      sbGet(`plan_comments?plan_id=eq.${id}&select=id,updated_at,is_decision,decided_at&order=id`),
      sbGet(`plan_tasks?plan_id=eq.${id}&select=id,done_at,title,due_date,assignee_id&order=id`),
      sbGet(`plan_ideas?plan_id=eq.${id}&select=id,updated_at,status,votes:plan_votes(teacher_id)&order=id`).catch(() => null),
      sbGet(`meetings?plan_id=eq.${id}&select=id,title,held_on,status,updated_at,applied_at,parts:meeting_parts(count)&order=id`),
      sbGet(`meeting_agenda?select=id,updated_at,seq,meetings!inner(plan_id)&meetings.plan_id=eq.${id}&order=id`).catch(() => null),
    ]);
    const stamp = createHash("sha1").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
    return NextResponse.json({ stamp }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "讀取失敗" }, { status: 502 });
  }
}

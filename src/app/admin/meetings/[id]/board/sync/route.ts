import { NextResponse, type NextRequest } from "next/server";
import { getStaff, actorOf } from "@/lib/staff";
import { audit, isUuid, sbGet, sbRpc } from "@/lib/supabase";
import { canModerate, type SyncResult } from "@/lib/board";

// 白板同步：瀏覽器約 2 秒送一次「我的變更＋我手上的版本」，回傳之後的所有變動與誰在線上。
// 用 route handler 而不是 server action：server action 會排隊一個一個執行，輪詢會卡住其他動作。
export const dynamic = "force-dynamic";

const OPS = new Set(["add", "move", "edit", "del"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: "請重新登入" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "資料不正確" }, { status: 400 });

  let body: { since?: unknown; ops?: unknown; editing?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "資料不正確" }, { status: 400 });
  }
  const since = Number.isSafeInteger(body.since) && (body.since as number) >= 0 ? (body.since as number) : 0;
  const editing = isUuid(body.editing) ? body.editing : null;
  const raw = Array.isArray(body.ops) ? body.ops : [];
  if (raw.length > 50) return NextResponse.json({ error: "一次變更太多" }, { status: 400 });
  const ops = raw.filter(
    (o): o is { op: string; id: string } =>
      !!o && typeof o === "object" && OPS.has((o as { op?: string }).op ?? "") && isUuid((o as { id?: string }).id),
  );

  const m = await sbGet<{ id: string; created_by: string | null; helpers: { teacher_id: string }[] }[]>(
    `meetings?id=eq.${id}&select=id,created_by,helpers:meeting_helpers(teacher_id)`,
  ).catch(() => null);
  if (!m) return NextResponse.json({ error: "白板還沒啟用（請先執行 0018）" }, { status: 503 });
  if (!m[0]) return NextResponse.json({ error: "找不到這場會議" }, { status: 404 });
  const mod = canModerate(m[0], m[0].helpers.map((h) => h.teacher_id), staff);

  try {
    const r = await sbRpc<SyncResult>("board_sync", {
      p_meeting: id, p_teacher: staff.id, p_mod: mod, p_ops: ops, p_since: since, p_editing: editing,
    });
    // 操作紀錄：拖動太頻繁不記，只記新增、改字、刪除的數量
    const count = (k: string) => ops.filter((o) => o.op === k).length;
    const changed = { add: count("add"), edit: count("edit"), del: count("del") };
    if (changed.add + changed.edit + changed.del > 0) {
      await audit(actorOf(staff), "board.change", `meetings:${id}`, { ...changed, rejected: r.rejected });
    }
    return NextResponse.json({ ...r, mod }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "同步失敗，稍後會自動重試" }, { status: 502 });
  }
}

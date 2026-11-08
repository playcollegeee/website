import { NextResponse } from "next/server";
import { getBookingByToken } from "@/lib/events";
import { sbPatch, supabaseConfig } from "@/lib/supabase";
import { TOO_MANY, allow, clientIp } from "@/lib/rateLimit";

// 家長回填匯款帳號末五碼（用報名查詢連結裡的編號＋金鑰確認身分）
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
  }
  if (!supabaseConfig()) return NextResponse.json({ error: "系統設定中" }, { status: 503 });
  if (!(await allow("payReport", clientIp(req.headers)))) return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const code = typeof b.code === "string" ? b.code.toUpperCase() : "";
  const token = typeof b.token === "string" ? b.token : "";
  const last5 = typeof b.last5 === "string" ? b.last5.replace(/\s/g, "") : "";
  if (!/^\d{5}$/.test(last5)) return NextResponse.json({ error: "請填 5 位數字" }, { status: 400 });
  const found = await getBookingByToken(code, token);
  if (!found) return NextResponse.json({ error: "找不到這筆報名，請確認連結是否完整" }, { status: 404 });
  if (!["pending", "registered"].includes(found.booking.status))
    return NextResponse.json({ error: "這筆報名目前不需要回填匯款資訊" }, { status: 400 });
  await sbPatch(`activity_bookings?id=eq.${found.booking.id}`, { pay_last5: last5, pay_reported_at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}

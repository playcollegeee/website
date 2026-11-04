import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { KIOSK_COOKIE, deviceFromKey } from "@/lib/kiosk";
import { sbRpc, supabaseConfig } from "@/lib/supabase";

// 簽到入口：教室平板、手機 NFC、ESP32 讀卡機都呼叫這裡。
// 驗證：平板用 cookie；ESP32 用 Authorization: Bearer <讀卡站金鑰>
// 回傳只含角色暱稱，不含真實姓名。
export async function POST(req: Request) {
  if (!supabaseConfig()) return NextResponse.json({ result: "error", message: "系統尚未設定" }, { status: 503 });

  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const jar = await cookies();
  const device = await deviceFromKey(bearer ?? jar.get(KIOSK_COOKIE)?.value);
  if (!device) return NextResponse.json({ result: "unauthorized" }, { status: 401 });

  let uid = "";
  try {
    const body = (await req.json()) as { uid?: unknown };
    uid = typeof body.uid === "string" ? body.uid.slice(0, 60) : "";
  } catch {
    return NextResponse.json({ result: "invalid" }, { status: 400 });
  }
  if (!uid) return NextResponse.json({ result: "invalid" }, { status: 400 });

  try {
    const out = await sbRpc<Record<string, unknown>>("checkin_by_card", { p_uid: uid, p_device: device.id });
    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ result: "error", message: "系統忙碌，請再刷一次" }, { status: 502 });
  }
}

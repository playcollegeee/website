import { NextResponse } from "next/server";
import { sbFetch, sbGet, supabaseConfig, isUuid } from "@/lib/supabase";
import { TOO_MANY, allow, clientIp } from "@/lib/rateLimit";

// 「我想上這堂」湊班登記：同一主題累計 3 人以上，後台會提醒老師開課
const PHONE = /^[0-9+\-()\s]{8,20}$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
  }
  if (clean(b.website, 200)) return NextResponse.json({ ok: true });
  if (!supabaseConfig()) return NextResponse.json({ error: "系統設定中" }, { status: 503 });
  if (!(await allow("interest", clientIp(req.headers)))) return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const themeId = clean(b.themeId, 40);
  const name = clean(b.contactName, 40);
  const phone = clean(b.phone, 20);
  const email = clean(b.email, 120);
  const headcount = Math.min(Math.max(Number(b.headcount) || 1, 1), 30);
  if (!isUuid(themeId)) return NextResponse.json({ error: "資料不正確" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "請填寫聯絡人姓名" }, { status: 400 });
  if (!PHONE.test(phone)) return NextResponse.json({ error: "手機號碼格式看起來不正確" }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email 格式不正確" }, { status: 400 });
  if (b.consent !== true) return NextResponse.json({ error: "請勾選同意我們用這些資料聯絡您開課消息" }, { status: 400 });
  const theme = (await sbGet<{ id: string }[]>(`activity_themes?id=eq.${themeId}&published=eq.true&select=id`).catch(() => []))[0];
  if (!theme) return NextResponse.json({ error: "找不到這個主題" }, { status: 404 });
  const res = await sbFetch("activity_interests", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      theme_id: themeId,
      contact_name: name,
      phone: phone.replace(/[^0-9+]/g, ""),
      email: email || null,
      social_name: clean(b.socialName, 60) || null,
      headcount,
      who_text: clean(b.whoText, 120) || null,
      prefer_text: clean(b.preferText, 200) || null,
    }),
  });
  if (!res.ok) return NextResponse.json({ error: "送出失敗，請稍後再試或私訊粉專" }, { status: 502 });
  return NextResponse.json({ ok: true });
}

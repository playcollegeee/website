import { NextResponse } from "next/server";
import { TOO_MANY, allow, clientIp } from "@/lib/rateLimit";

// 試聽／諮詢表單：驗證後寫入 Supabase 的 leads 表。
// 需要在 Vercel 設定 SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY（只存在伺服器端）。

const TYPES = new Set(["trial", "workshop", "school", "other"]);
const LEVELS = new Set(["wanbao", "wantong", "wanle", "wanchuang", "wanjia", ""]);
const MAJORS = new Set(["lego", "3d", "art"]);

function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
  }

  // 防機器人：隱藏欄位有填就當作送出成功，但不寫入
  if (clean(body.website, 200)) return NextResponse.json({ ok: true });
  if (!(await allow("trial", clientIp(req.headers)))) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const type = clean(body.type, 20);
  const guardianName = clean(body.guardianName, 40);
  const phone = clean(body.phone, 20);
  const email = clean(body.email, 120);
  const childLevel = clean(body.childLevel, 20);
  const message = clean(body.message, 1000);
  const interests = Array.isArray(body.interests)
    ? body.interests.filter((x): x is string => typeof x === "string" && MAJORS.has(x))
    : [];

  if (!TYPES.has(type)) return NextResponse.json({ error: "請選擇詢問類型" }, { status: 400 });
  if (!guardianName) return NextResponse.json({ error: "請填寫姓名" }, { status: 400 });
  if (!/^[0-9+\-()\s]{8,20}$/.test(phone)) return NextResponse.json({ error: "電話格式看起來不正確" }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email 格式不正確" }, { status: 400 });
  if (!LEVELS.has(childLevel)) return NextResponse.json({ error: "年級選項不正確" }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: "請勾選同意個資使用說明" }, { status: 400 });

  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return NextResponse.json({ error: "線上表單尚在設定中" }, { status: 503 });
  }

  const res = await fetch(`${url}/rest/v1/leads`, {
    method: "POST",
    headers: {
      apikey: key,
      // 舊版 service_role 金鑰（JWT，eyJ 開頭）才需要放 Authorization；新版 sb_secret_ 金鑰只放 apikey
      ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      type,
      guardian_name: guardianName,
      phone,
      email: email || null,
      child_level: childLevel || null,
      interests,
      message: message || null,
      consent_at: new Date().toISOString(),
      source: "website",
    }),
  });

  if (!res.ok) {
    // 只記錄金鑰的格式與長度，不記錄金鑰本身
    const kind = key.startsWith("sb_secret_") ? "sb_secret" : key.startsWith("sb_publishable_") ? "sb_publishable" : key.startsWith("eyJ") ? "jwt" : "unknown";
    console.error("leads insert failed", res.status, await res.text(), { keyKind: kind, keyLength: key.length, hasMask: key.includes("•") });
    return NextResponse.json({ error: "系統忙碌中，請稍後再試" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

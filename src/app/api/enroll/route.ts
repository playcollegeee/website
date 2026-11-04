import { NextResponse } from "next/server";
import { CONSENT_VERSION } from "@/lib/consent";
import { sbFetch, supabaseConfig } from "@/lib/supabase";

// 線上新生報名：驗證後寫入 registration_requests（待老師審核），不直接建立學生。
const LEVELS = new Set(["wanbao", "wantong", "wanle", "wanchuang", "wanjia"]);
const MAJORS = new Set(["lego", "3d", "art"]);
const SCOPES = new Set(["none", "works", "all"]);
const PHONE = /^[0-9+\-()\s]{8,20}$/;

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const opt = (v: unknown, max: number) => clean(v, max) || null;

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
  }
  if (clean(b.website, 200)) return NextResponse.json({ ok: true }); // 防機器人欄位

  const childName = clean(b.childName, 40);
  const nickname = clean(b.nickname, 20);
  const level = clean(b.level, 20);
  const guardianName = clean(b.guardianName, 40);
  const phone = clean(b.phone, 20);
  const email = clean(b.email, 120);
  const pickupPhone = clean(b.pickupPhone, 20);
  const careNotes = clean(b.careNotes, 500);
  const by = clean(b.birthYear, 4);
  const scope = clean(b.photoScope, 10) || "none";

  if (!childName || !nickname) return NextResponse.json({ error: "請填寫孩子姓名與角色暱稱" }, { status: 400 });
  if (nickname === childName) return NextResponse.json({ error: "角色暱稱請不要用孩子的本名" }, { status: 400 });
  if (!LEVELS.has(level)) return NextResponse.json({ error: "請選擇孩子的階段" }, { status: 400 });
  if (!guardianName) return NextResponse.json({ error: "請填寫家長姓名" }, { status: 400 });
  if (!PHONE.test(phone)) return NextResponse.json({ error: "手機號碼格式看起來不正確" }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email 格式不正確" }, { status: 400 });
  if (pickupPhone && !PHONE.test(pickupPhone)) return NextResponse.json({ error: "接送人電話格式不正確" }, { status: 400 });
  if (by && !/^(19|20)\d{2}$/.test(by)) return NextResponse.json({ error: "出生年請填西元年，例如 2017" }, { status: 400 });
  if (!SCOPES.has(scope)) return NextResponse.json({ error: "照片公開選項不正確" }, { status: 400 });
  if (careNotes && b.careConsent !== true) return NextResponse.json({ error: "填寫照護注意事項時，請勾選同意記錄" }, { status: 400 });
  if (b.consent !== true) return NextResponse.json({ error: "請閱讀並勾選個資告知同意" }, { status: 400 });
  if (!supabaseConfig()) return NextResponse.json({ error: "線上報名尚在設定中" }, { status: 503 });

  const interests = Array.isArray(b.interests) ? b.interests.filter((x): x is string => typeof x === "string" && MAJORS.has(x)) : [];
  const res = await sbFetch("registration_requests", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      child_name: childName,
      child_nickname: nickname,
      child_level: level,
      child_birth_year: by ? Number(by) : null,
      child_gender: opt(b.gender, 10),
      child_school: opt(b.school, 60),
      interests,
      guardian_name: guardianName,
      guardian_relation: opt(b.relation, 10),
      guardian_phone: phone.replace(/[^0-9+]/g, ""),
      guardian_email: email || null,
      pickup_name: opt(b.pickupName, 40),
      pickup_relation: opt(b.pickupRelation, 10),
      pickup_phone: pickupPhone ? pickupPhone.replace(/[^0-9+]/g, "") : null,
      consent_version: CONSENT_VERSION,
      consent_at: new Date().toISOString(),
      photo_scope: scope,
      marketing_consent: b.marketing === true,
      care_notes: careNotes || null,
      care_consent: !!careNotes && b.careConsent === true,
      message: opt(b.message, 1000),
    }),
  });
  if (!res.ok) return NextResponse.json({ error: "送出失敗，請稍後再試或直接聯絡我們" }, { status: 502 });
  return NextResponse.json({ ok: true });
}

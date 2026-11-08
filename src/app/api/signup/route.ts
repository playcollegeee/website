import { NextResponse } from "next/server";
import { ACTIVITY_CONSENT_VERSION } from "@/lib/consent";
import { getRunBundle, newCode, newToken } from "@/lib/events";
import { sbFetch, supabaseConfig, isUuid } from "@/lib/supabase";
import { TOO_MANY, allow, clientIp } from "@/lib/rateLimit";

// 活動報名：驗證後交給資料庫函式 book_activity()（鎖住場次、檢查名額、建名單、建報名）
const PHONE = /^[0-9+\-()\s]{8,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
  }
  if (clean(b.website, 200)) return NextResponse.json({ ok: true, code: "", link: "" }); // 防機器人欄位
  if (!supabaseConfig()) return NextResponse.json({ error: "線上報名尚在設定中" }, { status: 503 });
  if (!(await allow("signup", clientIp(req.headers)))) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const runId = clean(b.runId, 40);
  const slotId = clean(b.slotId, 40);
  if (!isUuid(runId) || !isUuid(slotId)) return NextResponse.json({ error: "請選擇場次" }, { status: 400 });
  const bundle = await getRunBundle(runId);
  if (!bundle || bundle.run.status !== "open") return NextResponse.json({ error: "這個活動目前沒有開放報名" }, { status: 400 });
  const { run } = bundle;
  if (!bundle.slots.some((s) => s.id === slotId)) return NextResponse.json({ error: "請選擇場次" }, { status: 400 });

  const contactName = clean(b.contactName, 40);
  const phone = clean(b.phone, 20);
  const email = clean(b.email, 120);
  const socialName = clean(b.socialName, 60);
  if (!contactName) return NextResponse.json({ error: "請填寫聯絡人姓名" }, { status: 400 });
  if (!PHONE.test(phone)) return NextResponse.json({ error: "手機號碼格式看起來不正確" }, { status: 400 });
  if (!EMAIL.test(email)) return NextResponse.json({ error: "請填寫正確的 Email，報名通知會寄到這裡" }, { status: 400 });
  if (!socialName) return NextResponse.json({ error: "請填寫私訊粉專／IG 用的名字，方便我們對帳與通知" }, { status: 400 });
  if (b.refundAck !== true) return NextResponse.json({ error: "請閱讀並勾選取消與退費辦法" }, { status: 400 });
  if (b.consent !== true) return NextResponse.json({ error: "請閱讀並勾選個資告知同意" }, { status: 400 });

  // 參加者
  const rawPeople = Array.isArray(b.people) ? b.people.slice(0, 20) : [];
  const people = rawPeople.map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    let kind = o.kind === "adult" ? "adult" : "child";
    if (run.who === "adult") kind = "adult";
    if (run.who === "kids" || run.who === "family") kind = "child";
    const g = typeof o.grade === "string" || typeof o.grade === "number" ? Number(o.grade) : NaN;
    const care = clean(o.careNotes, 300);
    return {
      kind,
      name: clean(o.name, 40),
      grade: kind === "child" && Number.isInteger(g) && g >= -3 && g <= 12 ? g : null,
      care_notes: care,
      care_consent: !!care && o.careConsent === true,
    };
  });
  if (people.length === 0 || people.some((p) => !p.name)) return NextResponse.json({ error: "請填寫每一位參加者的姓名" }, { status: 400 });
  if (people.some((p) => p.kind === "child" && p.grade === null)) return NextResponse.json({ error: "請選擇孩子的年級" }, { status: 400 });
  if (people.some((p) => p.care_notes && !p.care_consent)) return NextResponse.json({ error: "填寫注意事項時，請勾選同意記錄" }, { status: 400 });

  // 自訂題目
  const rawAnswers = (b.answers ?? {}) as Record<string, unknown>;
  const answers: Record<string, string> = {};
  for (const q of run.questions ?? []) {
    const v = clean(rawAnswers[q.key], 300);
    if (q.required && !v) return NextResponse.json({ error: `請回答「${q.label}」` }, { status: 400 });
    if (v && q.type === "choice" && q.options && !q.options.includes(v)) return NextResponse.json({ error: `「${q.label}」的選項不正確` }, { status: 400 });
    if (v) answers[q.key] = v;
  }

  const token = newToken();
  const qty = Math.min(Math.max(Number(b.qty) || 1, 1), 10);
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode();
    const res = await sbFetch("rpc/book_activity", {
      method: "POST",
      body: JSON.stringify({
        p: {
          slot_id: slotId,
          price_key: clean(b.priceKey, 40),
          qty,
          contact_name: contactName,
          phone,
          email,
          social_name: socialName,
          code,
          token,
          photo_ok: b.photoOk === true,
          marketing: b.marketing === true,
          consent_version: ACTIVITY_CONSENT_VERSION,
          answers,
          message: clean(b.message, 1000),
          people,
        },
      }),
    });
    if (res.ok) {
      const r = (await res.json()) as { code: string; status: string; amount: number };
      return NextResponse.json({ ok: true, code: r.code, status: r.status, link: `/signup/done/${r.code}?t=${token}` });
    }
    const err = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    if (err.code === "23505" && /code/.test(err.message ?? "")) continue; // 報名編號撞號，換一個再試
    // 資料庫函式丟出的訊息（例如「這個場次已額滿」）直接給家長看；其他錯誤不外露
    const msg = err.code === "P0001" && err.message ? err.message : "送出失敗，請稍後再試或私訊粉專";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ error: "送出失敗，請稍後再試" }, { status: 500 });
}

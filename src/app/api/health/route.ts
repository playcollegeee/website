import { NextResponse } from "next/server";
import { sbFetch, supabaseConfig } from "@/lib/supabase";

// 健康檢查：給監控用。只回報「網站與資料庫是否正常」，不回傳任何資料。
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let db = false;
  if (supabaseConfig()) {
    try {
      const r = await sbFetch("teachers?select=id&limit=1", { signal: AbortSignal.timeout(5000) });
      db = r.ok;
    } catch {
      db = false;
    }
  }
  return NextResponse.json(
    { ok: db, db, ms: Date.now() - started },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

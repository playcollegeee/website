// 次數限制：同一來源在一段時間內只能嘗試幾次（資料表 rate_limits，migration 0006）。
// 資料庫還沒建好或暫時連不上時一律放行，不會讓正常使用者被擋在門外。
import { sbRpc } from "./supabase";
import { sha256Hex } from "./session";


export const LIMITS = {
  loginIp: { limit: 10, windowSec: 15 * 60 }, // 同一個網路 15 分鐘最多試 10 次登入
  loginEmail: { limit: 8, windowSec: 15 * 60 }, // 同一個帳號 15 分鐘最多試 8 次
  trial: { limit: 5, windowSec: 10 * 60 }, // 試聽／諮詢表單 10 分鐘 5 次
  enroll: { limit: 5, windowSec: 30 * 60 }, // 線上報名 30 分鐘 5 次
  signup: { limit: 6, windowSec: 30 * 60 }, // 活動報名 30 分鐘 6 次
  payReport: { limit: 10, windowSec: 10 * 60 }, // 回填匯款末五碼 10 分鐘 10 次
  interest: { limit: 5, windowSec: 10 * 60 }, // 「我想上這堂」10 分鐘 5 次
  checkin: { limit: 120, windowSec: 60 }, // 讀卡站 1 分鐘 120 次（正常上課不會碰到）
  ai: { limit: 30, windowSec: 60 * 60 }, // AI 產生教案初稿：每位老師 1 小時 30 次（控制費用）
  stt: { limit: 400, windowSec: 60 * 60 }, // 會議錄音轉文字：每位老師 1 小時 400 段（約 10 小時錄音）
} as const;

// 從請求標頭取出訪客 IP（Vercel 會放在 x-forwarded-for 第一個）
export function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

// 回傳 true 代表可以繼續；false 代表太頻繁
export async function allow(bucket: keyof typeof LIMITS, id: string): Promise<boolean> {
  const { limit, windowSec } = LIMITS[bucket];
  try {
    const key = `${bucket}:${(await sha256Hex(`pc-rl:${id}`)).slice(0, 32)}`;
    const ok = await sbRpc<boolean>("hit_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSec });
    return ok !== false;
  } catch {
    return true;
  }
}

export const TOO_MANY = "嘗試太頻繁，請稍等幾分鐘再試。";

// 讀卡站（教室平板、ESP32）的身分驗證：
//   平板：管理員在後台按「在這台裝置啟用」→ 瀏覽器存一個 httpOnly cookie（一年）
//   ESP32／Raspberry Pi：建立時顯示一次金鑰，放在 Authorization: Bearer <金鑰>
// 資料庫只存金鑰的 SHA-256，停用讀卡站後立刻失效。
import { sha256Hex } from "./session";
import { sbGet } from "./supabase";

export const KIOSK_COOKIE = "pc_kiosk";
export const KIOSK_MAX_AGE = 60 * 60 * 24 * 365;

export type Device = { id: string; name: string; room: string | null };

export async function deviceFromKey(key: string | undefined | null): Promise<Device | null> {
  if (!key || key.length < 20 || key.length > 100) return null;
  const hash = await sha256Hex(key);
  const rows = await sbGet<Device[]>(`devices?key_hash=eq.${hash}&active=eq.true&select=id,name,room`).catch(() => []);
  return rows[0] ?? null;
}

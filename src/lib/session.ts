// 老師登入狀態：簽章過的 cookie（伺服器與 proxy 都能驗證）。
// 簽章金鑰由 Supabase service key 推導而來，不需要另外設定環境變數；
// 換掉 service key 時，所有人會被登出，屬於正常現象。

export const STAFF_COOKIE = "pc_staff";
export const STAFF_MAX_AGE = 60 * 60 * 12; // 12 小時後要重新登入

export type StaffToken = { t: string; a: boolean; exp: number }; // 老師 id、是否管理員、到期時間（秒）

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(purpose: string): Promise<CryptoKey | null> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) return null;
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`playcollegeee:${purpose}:${secret}`));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signToken(payload: object, purpose = "staff"): Promise<string> {
  const key = await hmacKey(purpose);
  if (!key) throw new Error("Supabase 尚未設定");
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifyToken<T extends { exp: number }>(token: string | undefined, purpose = "staff"): Promise<T | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const key = await hmacKey(purpose);
  if (!key) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", key, fromB64url(sig) as BufferSource, enc.encode(body));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(body))) as T;
    return data.exp > Date.now() / 1000 ? data : null;
  } catch {
    return null;
  }
}

// 讀卡站金鑰：隨機產生，資料庫只存 SHA-256
export function randomKey(bytes = 24): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}
export async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

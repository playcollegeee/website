// 伺服器端專用：用 service key 呼叫 Supabase REST API。
// 金鑰只存在 Vercel 環境變數，絕不送到瀏覽器。

export function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export async function sbFetch(path: string, init: RequestInit = {}) {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Supabase 尚未設定");
  return fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: cfg.key,
      // 舊版 JWT 金鑰才需要 Authorization；新版 sb_secret_ 只放 apikey
      ...(cfg.key.startsWith("eyJ") ? { Authorization: `Bearer ${cfg.key}` } : {}),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

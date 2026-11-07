import { after } from "next/server";

// 伺服器端專用：用 service key 呼叫 Supabase（資料庫 REST API 與登入 Auth API）。
// 金鑰只存在 Vercel 環境變數，絕不送到瀏覽器。
// 權限檢查在我們自己的程式裡做（requireStaff），所以每個呼叫前都要先確認是誰在操作。

export function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export function authHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    // 舊版 JWT 金鑰才需要 Authorization；新版 sb_secret_ 只放 apikey
    ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
  };
}

export async function sbFetch(path: string, init: RequestInit = {}) {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Supabase 尚未設定");
  return fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: { ...authHeaders(cfg.key), "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

// Supabase Auth（登入、建立老師帳號、改密碼）
export async function sbAuthFetch(path: string, init: RequestInit = {}) {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Supabase 尚未設定");
  return fetch(`${cfg.url}/auth/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: { ...authHeaders(cfg.key), "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

async function fail(res: Response, what: string): Promise<never> {
  let msg = "";
  try {
    const j = (await res.json()) as { message?: string; details?: string };
    msg = j.message ?? "";
  } catch {}
  throw new Error(`${what}失敗（${res.status}）${msg ? `：${msg}` : ""}`);
}

// 讀資料：sbGet<Student[]>("students?select=*&active=eq.true")
export async function sbGet<T>(path: string): Promise<T> {
  const res = await sbFetch(path);
  if (!res.ok) await fail(res, "讀取");
  return (await res.json()) as T;
}

// 新增資料並取回新增的那一筆
export async function sbInsert<T = Record<string, unknown>>(table: string, row: object, upsert?: string): Promise<T> {
  const res = await sbFetch(`${table}${upsert ? `?on_conflict=${upsert}` : ""}`, {
    method: "POST",
    headers: { Prefer: `return=representation${upsert ? ",resolution=merge-duplicates" : ""}` },
    body: JSON.stringify(row),
  });
  if (!res.ok) await fail(res, "儲存");
  const rows = (await res.json()) as T[];
  return rows[0];
}

export async function sbPatch(pathWithFilter: string, patch: object): Promise<void> {
  const res = await sbFetch(pathWithFilter, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) await fail(res, "更新");
}

export async function sbDelete(pathWithFilter: string): Promise<void> {
  const res = await sbFetch(pathWithFilter, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  if (!res.ok) await fail(res, "刪除");
}

// 呼叫資料庫函式（例：checkin_by_card）
export async function sbRpc<T>(fn: string, args: object): Promise<T> {
  const res = await sbFetch(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
  if (!res.ok) await fail(res, "執行");
  return (await res.json()) as T;
}

// 操作紀錄：每次寫入都留下是誰、做了什麼（失敗不影響主要動作）
// 用 after() 排在回應送出之後才寫，老師不用多等這一趟；不在請求流程裡時就直接寫。
export async function audit(actor: string, action: string, target: string, detail?: object) {
  const write = () =>
    sbFetch("audit_log", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ actor, action, target, detail: detail ?? null }),
    })
      .then(() => undefined)
      .catch(() => undefined);
  try {
    after(write);
  } catch {
    await write();
  }
}

// ---------- 檔案儲存（Supabase Storage） ----------
// 上傳到公開 bucket，回傳公開網址；path 例：gallery/1730000000-ab12.webp
export async function sbUpload(bucket: string, path: string, file: Blob, contentType: string): Promise<string> {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Supabase 尚未設定");
  const res = await fetch(`${cfg.url}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: { ...authHeaders(cfg.key), "Content-Type": contentType, "x-upsert": "true", "Cache-Control": "max-age=31536000" },
    body: file,
  });
  if (!res.ok) await fail(res, "上傳");
  return `${cfg.url}/storage/v1/object/public/${bucket}/${path}`;
}

// 私人 bucket 的限時連結；download 有值時瀏覽器會以這個檔名下載
// Supabase 回傳的 signedURL 是相對路徑（/object/sign/...），這裡補成完整網址
export async function sbSignUrls(
  bucket: string,
  paths: string[],
  expiresIn = 3600,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const cfg = supabaseConfig();
  if (!cfg || paths.length === 0) return out;
  const res = await fetch(`${cfg.url}/storage/v1/object/sign/${bucket}`, {
    method: "POST",
    headers: { ...authHeaders(cfg.key), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn, paths }),
    cache: "no-store",
  });
  if (!res.ok) return out;
  for (const r of (await res.json()) as { path: string | null; signedURL: string | null; error: string | null }[]) {
    if (r.path && r.signedURL) out.set(r.path, `${cfg.url}/storage/v1${r.signedURL}`);
  }
  return out;
}

export async function sbSignUrl(bucket: string, path: string, expiresIn = 60, download?: string): Promise<string | null> {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  const res = await fetch(`${cfg.url}/storage/v1/object/sign/${bucket}/${path}`, {
    method: "POST",
    headers: { ...authHeaders(cfg.key), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const { signedURL } = (await res.json()) as { signedURL?: string };
  if (!signedURL) return null;
  const url = `${cfg.url}/storage/v1${signedURL}`;
  return download === undefined ? url : `${url}&download=${encodeURIComponent(download)}`;
}

export async function sbRemoveFile(bucket: string, path: string): Promise<void> {
  const cfg = supabaseConfig();
  if (!cfg) return;
  await fetch(`${cfg.url}/storage/v1/object/${bucket}/${path}`, { method: "DELETE", headers: authHeaders(cfg.key) }).catch(() => undefined);
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

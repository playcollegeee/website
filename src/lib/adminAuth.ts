// 後台密碼檢查（HTTP Basic Auth）。
// 帳號固定為 admin，密碼放在 Vercel 環境變數 ADMIN_PASSWORD（請用英數字）。
// proxy.ts 會先擋一次；頁面與動作裡再檢查一次，避免設定出錯時資料外流。

export const ADMIN_USER = "admin";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function adminPassword(): string | null {
  const pw = process.env.ADMIN_PASSWORD?.trim();
  return pw && pw.length >= 8 ? pw : null;
}

export function isAdminAuthorized(authorization: string | null): boolean {
  const pw = adminPassword();
  if (!pw || !authorization?.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = atob(authorization.slice(6).trim());
  } catch {
    return false;
  }
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  return safeEqual(decoded.slice(0, i), ADMIN_USER) && safeEqual(decoded.slice(i + 1), pw);
}

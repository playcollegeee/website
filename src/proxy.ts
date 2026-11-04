import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE, verifyToken } from "@/lib/session";

// 後台與讀卡站的第一道閘門：沒登入就導向登入頁。
// 頁面與動作裡會再用 requireStaff() 檢查一次，並確認老師帳號仍在使用中。
export async function proxy(req: NextRequest) {
  const ok = await verifyToken(req.cookies.get(STAFF_COOKIE)?.value);
  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = { matcher: ["/admin", "/admin/:path*"] };

import { NextResponse, type NextRequest } from "next/server";
import { adminPassword, isAdminAuthorized } from "@/lib/adminAuth";

// /admin 後台的登入閘門：瀏覽器會跳出帳號密碼視窗
export function proxy(req: NextRequest) {
  if (!adminPassword()) {
    return new NextResponse("後台尚未設定密碼（請在 Vercel 設定 ADMIN_PASSWORD，至少 8 碼）", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (isAdminAuthorized(req.headers.get("authorization"))) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  return new NextResponse("需要登入", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Play Collegeee admin", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export const config = { matcher: ["/admin", "/admin/:path*"] };

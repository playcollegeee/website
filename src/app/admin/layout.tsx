import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbFetch } from "@/lib/supabase";
import { logout } from "../login/actions";
import AdminNav from "./AdminNav";
import PendingFeedback from "./PendingFeedback";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "後台", template: "%s｜玩學院後台" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  // 待審核的線上報名筆數（顯示在選單上）
  const pending = await sbFetch("registration_requests?status=eq.pending&select=id", {
    method: "HEAD",
    headers: { Prefer: "count=exact" },
  })
    .then((r) => Number(r.headers.get("content-range")?.split("/")[1] ?? 0))
    .catch(() => 0);
  const links = [
    { href: "/admin", label: "今日課程" },
    { href: "/admin/registrations", label: "報名", badge: pending },
    { href: "/admin/students", label: "學生" },
    { href: "/admin/classes", label: "開班" },
    { href: "/admin/cards", label: "卡片" },
    ...(staff.is_admin
      ? [
          { href: "/admin/leads", label: "詢問" },
          { href: "/admin/teachers", label: "老師" },
          { href: "/admin/devices", label: "讀卡站" },
        ]
      : []),
  ];
  return (
    <div className="adm">
      <header className="adm-bar">
        <Link href="/admin" className="adm-brand">
          <img src="/brand/logo-icon.png" alt="" width={32} height={32} />
          <span>玩學院後台</span>
        </Link>
        <AdminNav links={links} />
        <div className="adm-me">
          <Link href="/admin/account">{staff.nickname ?? staff.name}</Link>
          <form action={logout}>
            <button type="submit" className="adm-link">登出</button>
          </form>
        </div>
      </header>
      <main id="main" className="adm-main">{children}</main>
      <PendingFeedback />
    </div>
  );
}

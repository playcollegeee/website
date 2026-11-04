import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "老師登入", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next?.startsWith("/admin") ? next : "/admin";
  if (await getStaff()) redirect(target);
  return (
    <main className="login">
      <div className="login-card">
        <Link href="/" className="login-brand">
          <img src="/brand/logo-icon.png" alt="" width={56} height={56} />
          <span>玩學院 Play Collegeee</span>
        </Link>
        <h1>老師登入</h1>
        <p className="hint">學生資料、點名與讀卡站管理</p>
        <LoginForm next={target} />
      </div>
    </main>
  );
}

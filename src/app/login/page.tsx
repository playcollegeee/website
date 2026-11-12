import type { Metadata } from "next";
import Link from "next/link";
import { getStaff } from "@/lib/staff";
import LoginForm from "./LoginForm";
import LogoFloat from "./LogoFloat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "老師登入", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next?.startsWith("/admin") ? next : "/admin";
  // 已登入的人也走同一個開門動畫再進後台（不在伺服器直接轉址：登入成功後頁面會重新整理，
  // 這裡如果直接轉址，開門動畫會被打斷）
  const signedIn = !!(await getStaff());
  return (
    <main className="login">
      <LogoFloat />
      <div className="login-card">
        <Link href="/" className="login-brand">
          <img src="/brand/logo-icon.png" alt="" width={44} height={44} />
          <span>玩學院 Play Collegeee</span>
        </Link>
        <h1>老師登入</h1>
        <p className="lg-sub">點名、教案、課程規劃與活動報名都在裡面。</p>
        <LoginForm next={target} signedIn={signedIn} />
      </div>
    </main>
  );
}

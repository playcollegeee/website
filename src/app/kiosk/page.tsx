import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { KIOSK_COOKIE, deviceFromKey } from "@/lib/kiosk";
import Kiosk from "./Kiosk";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "玩學院讀卡站", robots: { index: false, follow: false } };

export default async function KioskPage() {
  const jar = await cookies();
  const device = await deviceFromKey(jar.get(KIOSK_COOKIE)?.value);
  if (!device) {
    return (
      <main className="kiosk kiosk-setup">
        <img src="/brand/logo-icon.png" alt="" width={96} height={96} />
        <h1>這台裝置還不是讀卡站</h1>
        <p>請管理員在這台裝置上登入後台 → 讀卡站 → 按「在這台裝置啟用」。</p>
        <Link href="/admin/devices" className="btn primary">前往後台設定</Link>
      </main>
    );
  }
  return <Kiosk deviceName={device.name} />;
}

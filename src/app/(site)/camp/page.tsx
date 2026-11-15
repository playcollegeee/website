import type { Metadata } from "next";
import Link from "next/link";
import CampView from "@/components/camp/CampView";
import { getCurrentSeason } from "@/lib/camps";
import { cardsOf } from "./load";

export const dynamic = "force-dynamic"; // 名額要即時

export async function generateMetadata(): Promise<Metadata> {
  const s = await getCurrentSeason().catch(() => null);
  return {
    title: s ? s.title : "冬夏令營",
    description: s?.headline || "玩學院寒暑假營隊：LEGO 樂高、3D 列印造物、美術，全天動手做，帶回自己的作品。",
    alternates: { canonical: "/camp" },
  };
}

// 官網：目前的冬夏令營（後台「冬夏令營頁面」管理）
export default async function CampPage() {
  const s = await getCurrentSeason().catch(() => null);
  if (!s) {
    return (
      <section>
        <div className="container">
          <p className="eyebrow">冬夏令營</p>
          <h1>營隊準備中</h1>
          <p className="lead">寒暑假營隊開放報名時會公告在這裡，也可以先看看平常的活動與工作坊。</p>
          <div className="btn-row">
            <Link href="/workshops" className="btn primary">活動與工作坊</Link>
            <Link href="/contact?type=workshop&activity=冬夏令營" className="btn">開放時通知我</Link>
          </div>
        </div>
      </section>
    );
  }
  return <CampView season={s} cards={await cardsOf(s)} />;
}

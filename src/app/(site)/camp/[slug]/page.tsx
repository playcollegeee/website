import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CampView from "@/components/camp/CampView";
import { getSeasonBySlug } from "@/lib/camps";
import { getStaff } from "@/lib/staff";
import { cardsOf } from "../load";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSeasonBySlug(slug);
  if (!s) return { title: "冬夏令營" };
  return {
    title: s.title,
    description: s.headline || undefined,
    ...(s.status !== "published" ? { robots: { index: false, follow: false } } : {}),
  };
}

// 官網：指定的一季（草稿只有登入的老師可以預覽）
export default async function CampSeasonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getSeasonBySlug(slug);
  if (!s) notFound();
  const preview = s.status !== "published";
  if (preview && !(await getStaff())) notFound();
  return <CampView season={s} cards={await cardsOf(s)} preview={preview} />;
}

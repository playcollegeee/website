// 冬夏令營頁面：組出官網要的資料（/camp 與 /camp/[slug] 共用）
import { loadPrograms, toCard, todayTw, type CampCard, type CampSeason } from "@/lib/camps";

export async function cardsOf(s: CampSeason): Promise<CampCard[]> {
  const today = todayTw();
  const bundles = await loadPrograms(s.id, true).catch(() => []);
  return bundles.map((b, i) => toCard(b, i, today));
}

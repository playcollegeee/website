import { sbGet } from "./supabase";

// 最近刷過、但還沒綁定的卡號（給「綁定新卡」的下拉選單用）
export async function recentUnknownUids(limit = 8): Promise<{ uid: string; at: string }[]> {
  const scans = await sbGet<{ uid: string; scanned_at: string }[]>(
    "card_scans?result=eq.unknown&order=id.desc&limit=50&select=uid,scanned_at",
  );
  const uniq = new Map<string, string>();
  for (const s of scans) if (!uniq.has(s.uid)) uniq.set(s.uid, s.scanned_at);
  if (uniq.size === 0) return [];
  const list = [...uniq.keys()].map((u) => `"${u}"`).join(",");
  const bound = await sbGet<{ uid: string }[]>(`cards?uid=in.(${list})&revoked_at=is.null&select=uid`);
  const taken = new Set(bound.map((b) => b.uid));
  return [...uniq].filter(([u]) => !taken.has(u)).slice(0, limit).map(([uid, at]) => ({ uid, at }));
}

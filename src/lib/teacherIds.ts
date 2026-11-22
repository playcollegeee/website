// 只在伺服器使用（server action、route handler）
import { isUuid, sbGet } from "@/lib/supabase";

// 多位負責老師（0024、0026）：去掉重複、最多 8 位，每位都要是在職老師（伺服器專用）
export async function validTeacherIds(ids: unknown): Promise<string[]> {
  const list = [...new Set((Array.isArray(ids) ? ids : []).filter((x): x is string => typeof x === "string" && x !== ""))].slice(0, 8);
  if (!list.length) return [];
  if (!list.every(isUuid)) throw new Error("老師資料不正確");
  const t = await sbGet<{ id: string }[]>(`teachers?id=in.(${list.join(",")})&active=eq.true&select=id`);
  if (t.length !== list.length) throw new Error("找不到其中一位老師");
  return list;
}

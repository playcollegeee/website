// 會議（規劃頁、會議室共用）：型別與狀態文字。伺服器與瀏覽器都可以引用
import type { Person } from "./plans";
import type { MeetingAi } from "@/app/admin/plans/meetingActions";

export type Meeting = {
  id: string; title: string; held_on: string | null; status: string; parts_total: number; duration_sec: number | null;
  summary: string | null; ai_result: MeetingAi | null; applied_at: string | null; created_by: string | null; created_at: string;
  seq?: number | null; creator?: Person; parts?: { count: number }[];
};

export const meetingStatus = (m: Meeting) => {
  const done = m.parts?.[0]?.count ?? 0;
  if (m.status === "planned") return "📅 待開會";
  if (m.status === "ready") return m.applied_at ? "✅ 已整理並套用" : "📝 AI 已整理，待確認";
  if (m.status === "summarizing") return "AI 整理中";
  return `轉文字 ${done}／${m.parts_total}`;
};
export const ROOM_CTA = "🧩 進入會議室一起討論吧！";


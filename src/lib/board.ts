// 會議討論白板（migration 0018）共用常數與型別。瀏覽器元件也會引用，這裡不要引入伺服器專用的東西。

export const BOARD_COLORS = [
  { value: "yellow", label: "黃", bg: "#FFE58A", line: "#FBC20F" },
  { value: "green", label: "綠", bg: "#C9EDE4", line: "#5CBEAA" },
  { value: "red", label: "紅", bg: "#FAD0CF", line: "#EA5754" },
  { value: "blue", label: "藍", bg: "#CFE3F6", line: "#5098D2" },
  { value: "white", label: "白", bg: "#FFFFFF", line: "#C9C2B2" },
] as const;
export type BoardColor = (typeof BOARD_COLORS)[number]["value"];
export const colorOf = (c: string) => BOARD_COLORS.find((x) => x.value === c) ?? BOARD_COLORS[0];

export const NOTE_W = 180;
export const NOTE_H = 120;
export const NOTE_MAX = 300; // 便利貼字數上限
export const SECTION_MAX = 60; // 分區框標題字數上限
export const BOARD_MAX_ITEMS = 500;
export const SYNC_MS = 2000; // 白板開著時約 2 秒同步一次
export const SYNC_IDLE_MS = 10000; // 分頁在背景時改成 10 秒

export type BoardItem = {
  id: string;
  kind: "note" | "section" | "arrow";
  from_id?: string | null; // 箭頭的起點（便利貼或分區框）
  to_id?: string | null; // 箭頭的終點
  x: number; y: number; w: number; h: number; z: number;
  color: BoardColor;
  text: string;
  author_id: string | null;
  updated_by: string | null;
  rev: number;
  deleted?: boolean;
};

export type BoardOp =
  | { op: "add"; id: string; kind: "note" | "section"; x: number; y: number; w: number; h: number; z: number; color: BoardColor; text: string }
  | { op: "add"; id: string; kind: "arrow"; from_id: string; to_id: string }
  | { op: "move"; id: string; x: number; y: number; w?: number; h?: number; z?: number }
  | { op: "edit"; id: string; text?: string; color?: BoardColor }
  | { op: "del"; id: string };

export type Presence = { teacher_id: string; editing: string | null };
export type SyncResult = { rev: number; items: BoardItem[]; presence: Presence[]; rejected: number };

// 可以管理整塊白板（改、刪任何便利貼與分區框）的人：會議建立者、小幫手老師、管理員
export const canModerate = (
  m: { created_by: string | null },
  helpers: string[],
  s: { id: string; is_admin: boolean },
) => s.is_admin || m.created_by === s.id || helpers.includes(s.id);

// 便利貼的中心點在分區框裡面，就算是這一區的
export const inside = (n: { x: number; y: number; w: number; h: number }, s: { x: number; y: number; w: number; h: number }) => {
  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;
  return cx >= s.x && cx <= s.x + s.w && cy >= s.y && cy <= s.y + s.h;
};

// 箭頭端點：從方框中心往另一個方框中心的方向，停在方框邊上
export function edgePoint(r: { x: number; y: number; w: number; h: number }, tx: number, ty: number) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const sx = dx ? (r.w / 2) / Math.abs(dx) : Infinity;
  const sy = dy ? (r.h / 2) / Math.abs(dy) : Infinity;
  const k = Math.min(sx, sy);
  return { x: cx + dx * k, y: cy + dy * k };
}

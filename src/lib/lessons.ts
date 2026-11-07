// 課程教案庫：共用的中文標籤、型別與表單整理
import { LEVEL_NAME, MAJOR_NAME } from "./admin";

export const LESSON_STATUS: Record<string, { label: string; tag: string }> = {
  draft: { label: "草稿", tag: "tag-yellow" },
  ready: { label: "可使用", tag: "tag-green" },
  archived: { label: "已封存", tag: "tag-gray" },
};

// 標籤五大類（順序就是畫面上的顯示順序）。
// 「技能」2026-11-07 拿掉（每堂課都會練，不另外標）；資料庫裡舊的技能標籤保留但不再顯示、編輯教案時會移除。
export const TAG_KINDS = [
  { value: "theme", label: "主題", hint: "例：交通工具、太空、動物" },
  { value: "structure", label: "結構", hint: "例：齒輪傳動、槓桿、三角支撐" },
  { value: "code", label: "程式", hint: "例：迴圈、條件判斷、感測器" },
  { value: "technique", label: "技巧", hint: "例：布林運算、列印支撐、疊色" },
  { value: "knowledge", label: "知識", hint: "例：摩擦力、重心、色彩三原色" },
] as const;
export type TagKind = (typeof TAG_KINDS)[number]["value"];
export const TAG_KIND_LABEL: Record<string, string> = Object.fromEntries(TAG_KINDS.map((k) => [k.value, k.label]));

// 教學流程三段
export const PHASES = [
  { value: "intro", label: "前導引導", hint: "引起動機的故事、提問、影片或圖片" },
  { value: "main", label: "主要活動", hint: "步驟、老師說什麼、孩子做什麼" },
  { value: "wrap", label: "分享與收尾", hint: "作品發表、回顧提問、整理收拾" },
] as const;
export type Phase = (typeof PHASES)[number]["value"];

export type Step = { phase: Phase; min: number | null; title: string; teacher: string; students: string };
export type Material = { name: string; qty: string };
export type Tag = { id: string; kind: string; name: string };
export type Category = { id: string; major: string; name: string; levels: string[]; sort: number; active: boolean };

export const DIFFICULTY = [1, 2, 3, 4, 5];
export const stars = (n: number | null) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "—");

export const categoryLabel = (c: { major: string; name: string } | null | undefined) =>
  c ? `${MAJOR_SHORT[c.major] ?? MAJOR_NAME[c.major] ?? ""}・${c.name}` : "未分類";
export const MAJOR_SHORT: Record<string, string> = { lego: "LEGO", "3d": "3D 列印", art: "美術" };
export const levelsLabel = (levels: string[]) => (levels.length ? levels.map((l) => LEVEL_NAME[l]).join("、") : "—");

// ---------- 表單資料整理（伺服器端用，防止亂塞資料） ----------
const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function parseSteps(json: string): Step[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const phases = new Set(PHASES.map((p) => p.value as string));
  return raw
    .slice(0, 60)
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const min = Number(o.min);
      return {
        phase: (phases.has(String(o.phase)) ? o.phase : "main") as Phase,
        min: Number.isInteger(min) && min > 0 && min <= 480 ? min : null,
        title: clip(o.title, 80),
        teacher: clip(o.teacher, 2000),
        students: clip(o.students, 2000),
      };
    })
    .filter((s) => s.title || s.teacher || s.students);
}

export function parseMaterials(json: string): Material[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 60)
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return { name: clip(o.name, 80), qty: clip(o.qty, 40) };
    })
    .filter((m) => m.name);
}

// 標籤名稱：去掉逗號與多餘空白，最多 30 字
export const cleanTagName = (v: string) => v.replace(/[,，、*%]/g, " ").replace(/\s+/g, " ").trim().slice(0, 30);

// 舊資料（timeline 只有 {min, teacher, students}）沒有 phase 時當作主要活動
export function stepsOf(timeline: unknown): Step[] {
  if (!Array.isArray(timeline)) return [];
  return timeline.map((t) => {
    const o = (t ?? {}) as Record<string, unknown>;
    return {
      phase: (["intro", "main", "wrap"].includes(String(o.phase)) ? o.phase : "main") as Phase,
      min: typeof o.min === "number" ? o.min : null,
      title: typeof o.title === "string" ? o.title : "",
      teacher: typeof o.teacher === "string" ? o.teacher : "",
      students: typeof o.students === "string" ? o.students : "",
    };
  });
}
export function materialsOf(materials: unknown): Material[] {
  if (!Array.isArray(materials)) return [];
  return materials.map((m) =>
    typeof m === "string"
      ? { name: m, qty: "" }
      : { name: String((m as Material)?.name ?? ""), qty: String((m as Material)?.qty ?? "") },
  ).filter((m) => m.name);
}

// 誰可以修改教案：作者本人或管理員（沒有作者的舊教案只有管理員能改）
export const canEditLesson = (staff: { id: string; is_admin: boolean }, authorId: string | null) =>
  staff.is_admin || (authorId !== null && authorId === staff.id);

// 教案照片與 .io 放的私人 bucket（migration 0008）
export const LESSON_BUCKET = "lesson-files";
export const fmtBytes = (n: number | null) =>
  n === null ? "" : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

// 教案下的「參考資料」「參考進行活動」（lesson_notes，migration 0010）
// 所有老師可新增；只能編輯自己寫的；舊資料（沒有作者）與其他老師寫的只有管理員能編輯；刪除只有管理員。
export const NOTE_KINDS = [
  { value: "ref", label: "參考資料", icon: "📚", hint: "繪本、影片、圖片、書籍、網址", placeholder: "例：繪本《好餓的毛毛蟲》，可以用來引起動機" },
  { value: "activity", label: "參考進行活動", icon: "🎬", hint: "你帶這堂課的做法、引導方式、變化玩法、遊戲", placeholder: "例：組好後玩「鱷魚吃青菜」：老師喊顏色，孩子找同色積木餵鱷魚，最後比誰餵最多" },
] as const;
export type NoteKind = (typeof NOTE_KINDS)[number]["value"];
export type LessonNote = {
  id: string;
  kind: NoteKind;
  body: string;
  url: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  author: { name: string; nickname: string | null } | null;
};
export const canEditNote = (n: { author_id: string | null }, s: { id: string; is_admin: boolean }) =>
  s.is_admin || (!!n.author_id && n.author_id === s.id);

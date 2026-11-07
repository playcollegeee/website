// 把教案整理成外部單位常用的三種表格（Word）。合作單位名稱不寫進程式（程式庫是公開的）。
import type { Block, Row } from "./docx";
import { stepsOf, materialsOf, type Step } from "./lessons";

export const EXPORT_FORMATS = {
  a: { label: "親子活動教案", hint: "引起動機／發展活動／綜合活動、給家長的話" },
  b: { label: "兒童活動設計與評估表", hint: "暖身／發展／綜合，各段分鐘數" },
  c: { label: "講師授課內容計畫", hint: "課程名稱、內容大綱" },
} as const;
export type ExportFormat = keyof typeof EXPORT_FORMATS;

// 階段 → 年齡文字（匯出後可再改）
const AGE: Record<string, string> = {
  wanbao: "3–6 歲", wantong: "7–8 歲（國小一～二年級）", wanle: "9–11 歲（國小三～五年級）",
  wanchuang: "12–14 歲（國小六～國二）", wanjia: "15 歲以上（國三以上）",
};
const FIELD: Record<string, string> = { lego: "建構", "3d": "科學／造物", art: "藝術創作" };

export type ExportLesson = {
  title: string; levels: string[]; minutes: number; goals: string | null; timeline: unknown; materials: unknown;
  parent_note: string | null; outline: string | null; summary: string | null; major: string | null;
};

const ageText = (levels: string[]) => (levels.length ? levels.map((l) => AGE[l]).filter(Boolean).join("、") : "");
const lines = (v: string | null) => (v ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
const numbered = (items: string[]) => items.map((x, i) => `${i + 1}. ${x.replace(/^\d+[.、]\s*/, "")}`);

// 一個流程段落 → 多行文字：「1. 標題：老師做什麼」＋「　孩子：…」
function stepLines(steps: Step[]): string[] {
  const out: string[] = [];
  steps.forEach((s, i) => {
    const teacher = lines(s.teacher);
    const head = s.title ? `${i + 1}. ${s.title}` : `${i + 1}. ${teacher.shift() ?? ""}`;
    out.push(s.title && teacher.length ? `${head}：${teacher.shift()}` : head);
    for (const t of teacher) out.push(`　${t}`);
    for (const t of lines(s.students)) out.push(`　孩子：${t}`);
  });
  return out;
}

export function buildExport(fmt: ExportFormat, l: ExportLesson, teacherName: string): Block[] {
  const steps = stepsOf(l.timeline);
  const phase = (p: string) => steps.filter((s) => s.phase === p);
  const mins = (p: string) => phase(p).reduce((n, s) => n + (s.min ?? 0), 0);
  const mats = materialsOf(l.materials).map((m) => (m.qty ? `${m.name}（${m.qty}）` : m.name));
  const goals = numbered(lines(l.goals));
  const age = ageText(l.levels);

  if (fmt === "a") {
    const rows: Row[] = [
      { label: "活動名稱", lines: [l.title] },
      { label: "活動年齡", lines: [age] },
      { label: "預期組數", lines: ["　組　人"] },
      { label: "活動類型", lines: ["□繪本故事 □藝術創作 □體能遊戲 □音樂律動 ■科學 □桌遊 □其他"] },
      { label: "所需資源", lines: [mats.join("、")] },
      { label: "活動目標", lines: goals },
      { label: "教學流程", lines: [], header: true },
      { label: "引起動機", lines: stepLines(phase("intro")) },
      { label: "發展活動", lines: stepLines(phase("main")) },
      { label: "綜合活動", lines: stepLines(phase("wrap")) },
      { label: "給家長的話", lines: lines(l.parent_note) },
      { label: "活動紀錄", lines: [], header: true },
      { label: "日期與時間", lines: ["　年　月　日（　）　：　～　："] },
      { label: "參與組數", lines: ["　組　人"] },
      { label: "反思與回饋", lines: [""] },
    ];
    return [{ type: "title", text: "親子活動教案" }, { type: "subtitle", text: `設計者：${teacherName}` }, { type: "table", rows }];
  }

  if (fmt === "b") {
    const seg = (p: string, name: string): Row => ({ label: `${name}${mins(p) ? `（${mins(p)} 分鐘）` : ""}`, lines: stepLines(phase(p)) });
    const rows: Row[] = [
      { label: "活動名稱", lines: [l.title] },
      { label: "帶課老師", lines: [teacherName] },
      { label: "協同老師", lines: [""] },
      { label: "對象", lines: [`${age} 之兒童與家長`] },
      { label: "活動領域", lines: [FIELD[l.major ?? ""] ?? ""] },
      { label: "活動目標", lines: goals },
      { label: "活動時間", lines: [`　年　月　日　：　－　：　，共 ${l.minutes} 分鐘`] },
      { label: "活動內容", lines: [], header: true },
      seg("intro", "暖身活動"),
      seg("main", "發展活動"),
      seg("wrap", "綜合活動"),
      { label: "活動資源", lines: mats },
      { label: "省思", lines: [""] },
    ];
    return [{ type: "title", text: "兒童活動設計與評估表" }, { type: "table", rows }];
  }

  const outline = lines(l.outline);
  if (!outline.length && l.summary) outline.push(l.summary);
  if (l.major === "lego") outline.push("在這堂課裡，老師將透過故事和遊戲引導，帶著孩子們一起用積木搭建出各種有趣且多樣化的造型！");
  const rows: Row[] = [
    { label: "講師姓名", lines: [teacherName] },
    { label: "日期／時間", lines: ["　年　月　日（　）　：　～　：", `幼兒年齡：${age}`] },
    { label: "授課人數", lines: ["　組親子"] },
    { label: "課程名稱", lines: [l.title] },
    { label: "內容大綱", lines: outline },
    { label: "配合項目（如材料等）", lines: [""] },
  ];
  return [
    { type: "title", text: "講師授課內容計畫" },
    { type: "table", rows, labelWidth: 2300 },
    { type: "para", text: "※ 身分證字號、戶籍地址、存摺等個人資料請自行填寫，系統不保存。" },
  ];
}

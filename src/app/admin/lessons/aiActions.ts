"use server";

import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbGet, sbSignUrl } from "@/lib/supabase";
import { LEVEL_NAME } from "@/lib/admin";
import { allow, TOO_MANY } from "@/lib/rateLimit";
import { askForJson, aiConfigured, AI_MODEL } from "@/lib/ai";
import {
  LESSON_BUCKET, TAG_KINDS, categoryLabel, cleanTagName, parseMaterials, parseSteps,
  type Material, type Step,
} from "@/lib/lessons";

// AI 教案初稿：老師給標題、類別、年齡（＋可選的補充說明與成品照），AI 產生各欄位的初稿，
// 回到表單由老師修改後再儲存。AI 不會直接寫進資料庫。

export type Draft = {
  summary: string;
  goals: string;
  refs: string;
  steps: Step[];
  challenge: string;
  support: string;
  materials: Material[];
  parent_note: string;
  outline: string;
  tags: Record<string, string[]>;
};
export type DraftResult = { ok: true; draft: Draft; usedPhoto: boolean } | { ok: false; message: string };

const SYSTEM = `你是「玩學院 Play Collegeee」（台中的兒童 STEAM 教室）的資深課程設計師，協助老師寫教案初稿。
玩學院的理念：透過「玩」幫助孩子發現興趣、能力與優勢；先探索、再發現、逐步深入。強調孩子親手從想法、設計到做出成品的過程。
五個階段：玩寶（幼幼～大班，約 3–6 歲，常是親子課）、玩童（小一～小二）、玩樂（小三～小五）、玩創（小六～國二）、玩家（國三以上）。
三大主修：LEGO 樂高建構與機器人、3D 列印與造物、美術與視覺創作。

寫作規則：
- 一律使用繁體中文、台灣用語，語氣溫暖、具體、好執行，給第一線老師看。
- 教學流程分三段：intro 前導引導（引起動機：繪本、提問、生活經驗）、main 主要活動（示範結構→跟著步驟組裝→自由改造）、wrap 分享與收尾（情境遊戲、作品分享、收拾教具）。每段 1–3 個步驟，分鐘數加總要等於課程時長。
- 每個步驟寫清楚「老師做什麼、說什麼、關鍵提問」與「孩子做什麼」。
- 學習目標 2–4 條，具體可觀察（孩子下課後能做到什麼），配合年齡。
- 繪本建議最多 3 本，只寫你很確定真實存在的繪本；不確定就不要寫。
- 不要寫孩子的名字、不要承諾學習成效、不要誇大。
- 標籤盡量從提供的既有標籤裡挑，真的沒有合適的才新增；每類 0–4 個。
- 如果有附成品照片，依照片描述作品的結構與可動的地方（例如齒輪、槓桿、輪軸），但不要編造照片裡看不到的細節。`;

// 範例：阿智老師過去交給合作單位的教案，讓 AI 學習語氣與格式
const EXAMPLE = `【範例教案：大嘴鱷魚（玩寶，親子，60 分鐘）】
學習目標：透過繪本故事，引導幼兒認識鱷魚的外型及各種蔬菜種類，培養生活經驗連結。／積木組裝大嘴巴鱷魚，練習手眼協調、空間概念與基礎結構建構能力。／透過設計鱷魚造型與吃青菜遊戲，鼓勵幼兒發揮創意，並培養分類與認知能力。
引起動機：老師自我介紹與使用教具；帶領親子共讀《愛吃青菜的鱷魚》；互動提問：小鱷魚為什麼最健康呢？牠吃了哪些東西？
發展活動：老師示範大嘴巴鱷魚的基本結構，觀察哪些零件可以讓嘴巴開合；引導親子依步驟共同組裝；完成後自由幫鱷魚設計造型。
綜合活動：用不同積木零件當成青菜玩「鱷魚吃青菜」，老師指定青菜、孩子找出來放進鱷魚嘴巴；一起收拾教具。
給家長的話：平時玩積木或玩具時，可以讓孩子們盡量發揮，不用限制組裝方向，讓他們盡情探索，有困難再加以引導協助即可。
活動簡介：哇！好大的嘴巴喔！快和老師一起用積木打造可愛又有趣的鱷魚，跟著牠張開大嘴吃吃吃，看看哪一隻鱷魚吃得最健康又強壯～`;

const str = { type: "string" };
const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "一句話簡介，30 字內" },
    goals: { type: "array", items: str, description: "學習目標 2–4 條" },
    picture_books: { type: "array", items: str, description: "繪本建議（書名），最多 3 本，只寫確定存在的" },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          phase: { type: "string", enum: ["intro", "main", "wrap"] },
          min: { type: "integer", description: "分鐘數" },
          title: { type: "string", description: "這一段在做什麼，15 字內" },
          teacher: { type: "string", description: "老師做什麼、說什麼、關鍵提問" },
          students: { type: "string", description: "孩子做什麼" },
        },
        required: ["phase", "min", "title", "teacher", "students"],
      },
    },
    challenge: { type: "string", description: "做得快的孩子的挑戰題" },
    support: { type: "string", description: "需要協助時的簡化版" },
    materials: {
      type: "array",
      items: { type: "object", properties: { name: str, qty: str }, required: ["name", "qty"] },
    },
    parent_note: { type: "string", description: "給家長的話，60–120 字" },
    outline: { type: "string", description: "對外活動簡介（宣傳、親子館簡章用），60–120 字，活潑有畫面" },
    tags: {
      type: "object",
      properties: Object.fromEntries(TAG_KINDS.map((k) => [k.value, { type: "array", items: str }])),
    },
  },
  required: ["summary", "goals", "steps", "challenge", "support", "materials", "parent_note", "outline", "tags"],
};

type Raw = {
  summary?: string; goals?: string[]; picture_books?: string[]; steps?: unknown[]; challenge?: string;
  support?: string; materials?: unknown[]; parent_note?: string; outline?: string; tags?: Record<string, unknown>;
};

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

// 取教案的封面照片（縮圖）給 AI 看
async function coverImage(lessonId: string) {
  const rows = await sbGet<{ thumb_path: string | null; storage_path: string; mime: string | null }[]>(
    `lesson_files?lesson_id=eq.${lessonId}&kind=eq.image&select=thumb_path,storage_path,mime&order=is_cover.desc,sort&limit=1`,
  );
  if (!rows[0]) return null;
  const url = await sbSignUrl(LESSON_BUCKET, rows[0].thumb_path ?? rows[0].storage_path, 60);
  if (!url) return null;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const type = res.headers.get("content-type")?.split(";")[0] || rows[0].mime || "image/webp";
  if (!/^image\/(webp|jpeg|png)$/.test(type)) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 3 * 1024 * 1024) return null;
  return { media_type: type, data: buf.toString("base64") };
}

export async function draftLesson(input: {
  title: string; categoryId: string; levels: string[]; minutes: number; notes: string; lessonId?: string;
}): Promise<DraftResult> {
  try {
    const staff = await requireStaff();
    if (!aiConfigured()) return { ok: false, message: "還沒設定 AI 金鑰，請管理員到 Vercel 設定 ANTHROPIC_API_KEY" };
    if (!(await allow("ai", staff.id))) return { ok: false, message: `AI ${TOO_MANY}` };

    const title = clip(input.title, 80);
    if (!title) return { ok: false, message: "請先填教案標題" };
    if (!isUuid(input.categoryId)) return { ok: false, message: "請先選課程類別" };
    const cats = await sbGet<{ major: string; name: string }[]>(`lesson_categories?id=eq.${input.categoryId}&select=major,name`);
    if (!cats[0]) return { ok: false, message: "找不到這個課程類別" };
    const levels = (input.levels ?? []).filter((l) => LEVEL_NAME[l]);
    const minutes = Number.isInteger(input.minutes) && input.minutes >= 10 && input.minutes <= 480 ? input.minutes : 60;
    const notes = clip(input.notes, 1500);

    const allTags = await sbGet<{ kind: string; name: string }[]>("tags?select=kind,name&order=name");
    const tagList = TAG_KINDS.map((k) => `${k.label}（${k.value}）：${allTags.filter((t) => t.kind === k.value).map((t) => t.name).join("、") || "（尚無）"}`).join("\n");

    const photo = input.lessonId && isUuid(input.lessonId) ? await coverImage(input.lessonId) : null;

    const text = `${EXAMPLE}

請幫我寫這個教案的初稿：
- 標題：${title}
- 類別：${categoryLabel(cats[0])}
- 適用階段：${levels.length ? levels.map((l) => LEVEL_NAME[l]).join("、") : "未指定（請依類別判斷）"}
- 時長：${minutes} 分鐘
${notes ? `- 老師的補充：${notes}\n` : ""}${photo ? "- 附上成品照片，請依照片描述作品結構。\n" : "- 沒有成品照片，請依標題設計常見的作法。\n"}
既有標籤（盡量從這裡挑）：
${tagList}`;

    const raw = await askForJson<Raw>({
      system: SYSTEM,
      content: [
        ...(photo ? [{ type: "image" as const, source: { type: "base64" as const, ...photo } }] : []),
        { type: "text", text },
      ],
      toolName: "lesson_draft",
      toolDescription: "回傳教案初稿的各個欄位",
      schema: SCHEMA,
    });

    // 整理成表單用的格式（長度、數量都限制住）
    const books = (raw.picture_books ?? []).map((b) => clip(b, 60)).filter(Boolean).slice(0, 3);
    const tags: Record<string, string[]> = {};
    for (const k of TAG_KINDS) {
      const v = raw.tags?.[k.value];
      tags[k.value] = Array.isArray(v) ? [...new Set(v.map((x) => cleanTagName(String(x))).filter(Boolean))].slice(0, 4) : [];
    }
    const draft: Draft = {
      summary: clip(raw.summary, 200),
      goals: (raw.goals ?? []).map((g) => clip(g, 300)).filter(Boolean).slice(0, 5).join("\n"),
      refs: books.map((b) => `繪本《${b.replace(/^《|》$/g, "")}》（AI 建議，請確認書名）`).join("\n"),
      steps: parseSteps(JSON.stringify(raw.steps ?? [])),
      challenge: clip(raw.challenge, 2000),
      support: clip(raw.support, 2000),
      materials: parseMaterials(JSON.stringify(raw.materials ?? [])),
      parent_note: clip(raw.parent_note, 1000),
      outline: clip(raw.outline, 1000),
      tags,
    };
    await audit(actorOf(staff), "lesson.ai_draft", input.lessonId ? `lessons:${input.lessonId}` : "lessons:new", {
      title, model: AI_MODEL, photo: !!photo,
    });
    return { ok: true, draft, usedPhoto: !!photo };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "AI 產生失敗，請再試一次" };
  }
}

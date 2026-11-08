// 活動與工作坊：型別與顯示文字（瀏覽器與伺服器都能用，不可引用 supabase）
export type ActivityKind = "workshop" | "camp" | "class" | "talk" | "event";
export type Audience = "kids" | "family" | "adult" | "all";
export type SignupMode = "contact" | "link" | "none";

export type Activity = {
  id: string;
  title: string;
  kind: ActivityKind;
  audience: Audience;
  audience_text: string | null;
  summary: string;
  tags: string[];
  schedule_text: string | null;
  price_text: string | null;
  signup: SignupMode;
  signup_url: string | null;
  image_url: string | null;
  storage_path: string | null;
  width: number;
  height: number;
  sort: number;
  published: boolean;
};

export const ACTIVITY_TAG = "activities";
export const ACTIVITY_FOLDER = "activities"; // 照片放在公開 bucket site-photos 的這個資料夾

export const KIND_LABEL: Record<ActivityKind, string> = {
  workshop: "工作坊",
  camp: "營隊",
  class: "常態課程",
  talk: "講座",
  event: "活動",
};

export const AUDIENCE_LABEL: Record<Audience, string> = {
  kids: "兒童",
  family: "親子",
  adult: "成人",
  all: "大人小孩都可以",
};

// 官網分組顯示的順序與標題
export const AUDIENCE_GROUPS: { title: string; lead: string; audiences: Audience[] }[] = [
  { title: "給孩子與親子", lead: "從一次體驗開始，帶著自己完成的作品回家。", audiences: ["kids", "family"] },
  { title: "大人小孩都能參加", lead: "親子一起來，或大人自己來玩都可以。", audiences: ["all"] },
  { title: "給大人", lead: "大人也需要動手玩：療癒、造物、親職，給自己一段專心的時間。", audiences: ["adult"] },
];


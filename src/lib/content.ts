// 官網內容集中在這裡。第一版先寫死，之後改成從 Supabase 的 courses / classes 表讀取，
// 各頁面不用改，只要換掉這支檔案的資料來源。

export const site = {
  name: "玩學院",
  nameEn: "Play Academy",
  tagline: "先探索、再發現、逐步深入，讓興趣成為孩子持續學習的動力。",
  city: "台中",
  email: "playcollegeee@gmail.com",
  // TODO: 換成正式的 LINE 官方帳號、FB、IG 連結
  line: "",
  facebook: "",
  instagram: "",
};

export type Level = {
  slug: string;
  name: string;
  grades: string;
  focus: string;
  color: "yellow" | "green" | "red" | "blue";
};

// 五階段分班（已確認，不可自行更改名稱與年級）
export const levels: Level[] = [
  { slug: "wanbao", name: "玩寶班", grades: "幼幼班至幼兒園大班", focus: "感官探索、積木操作、故事、基礎創作", color: "yellow" },
  { slug: "wantong", name: "玩童班", grades: "國小一至二年級", focus: "基礎建構、創意表達、簡單機械與邏輯", color: "green" },
  { slug: "wanle", name: "玩樂班", grades: "國小三至五年級", focus: "跨領域探索、科技實作、設計與造物", color: "red" },
  { slug: "wanchuang", name: "玩創班", grades: "國小六年級至國中二年級", focus: "進階技術、跨域整合、工程與專題", color: "blue" },
  { slug: "wanjia", name: "玩家班", grades: "國中三年級以上", focus: "自主專題、進階技術、作品集與專長發展", color: "yellow" },
];

export type Major = {
  slug: string;
  name: string;
  short: string;
  intro: string;
  from: string;
  topics: string[];
  path: { level: string; text: string }[];
  image?: string;
  color: Level["color"];
};

// 三大主修（已確認）
export const majors: Major[] = [
  {
    slug: "lego",
    name: "LEGO 樂高建構與機器人",
    short: "樂高主修",
    intro: "從積木故事、齒輪機構到感測器與程式，孩子一步步把想法變成會動的作品。",
    from: "玩寶班起",
    topics: ["積木建構與空間概念", "齒輪、滑輪、連桿等動力機械", "LEGO SPIKE Prime／EV3 機器人", "感測器、馬達與控制", "圖像化程式與 Python", "機器人任務、競賽與自主專題"],
    path: [
      { level: "玩寶", text: "積木操作、故事建構、簡單機械體驗" },
      { level: "玩童", text: "基礎建構、機械概念、簡單邏輯與任務" },
      { level: "玩樂", text: "動力機械、感測器、機器人及程式入門" },
      { level: "玩創", text: "進階機器人、工程設計、程式控制及專題" },
      { level: "玩家", text: "進階機器人、Python、競賽或自主專題" },
    ],
    image: "/images/catapult.webp",
    color: "red",
  },
  {
    slug: "3d",
    name: "3D 列印與造物",
    short: "3D 造物主修",
    intro: "畫出腦中的點子、建模、列印、測試再修正，做出真正能用、能玩的東西。",
    from: "國小三年級起",
    topics: ["3D 建模與立體空間概念", "列印原理、切片與列印設定", "材料與結構設計", "測試、修正與優化", "玩具、桌遊、公仔與實用物件", "Arduino 互動裝置與創客專題"],
    path: [
      { level: "玩樂", text: "基礎 3D 建模、造型設計、簡單列印作品" },
      { level: "玩創", text: "進階建模、功能性零件、機構與跨領域整合" },
      { level: "玩家", text: "完整設計流程、自主專題、互動裝置及作品集" },
    ],
    color: "green",
  },
  {
    slug: "art",
    name: "美術與視覺創作",
    short: "美術主修",
    intro: "觀察、色彩、構圖到立體造型，讓孩子用自己的方式表達想法。",
    from: "玩寶班起",
    topics: ["色彩與構圖", "觀察與表達", "繪畫及多媒材創作", "立體造型", "設計思考與視覺設計", "與 3D 建模、造物結合的跨域作品"],
    path: [
      { level: "玩寶", text: "感官媒材、色彩體驗、基礎創作" },
      { level: "玩童", text: "繪畫、造型、色彩及創意表達" },
      { level: "玩樂", text: "構圖、設計、媒材實驗及立體創作" },
      { level: "玩創", text: "進階創作、設計思考、跨域作品" },
      { level: "玩家", text: "自主創作、系列作品、作品集及個人風格" },
    ],
    color: "blue",
  },
];

export type Program = {
  name: string;
  audience: string;
  summary: string;
  tags: string[];
  image?: string;
};

// 目前實際在跑的活動與工作坊
export const programs: Program[] = [
  {
    name: "積木故事屋",
    audience: "3–6 歲幼兒（親子）",
    summary: "從繪本故事出發，親子一起用積木完成主題作品，再進入有趣的任務挑戰。每月一個新主題。",
    tags: ["親子", "每月主題", "約 60–70 分鐘"],
    image: "/images/croc.webp",
  },
  {
    name: "樂高動滋動",
    audience: "幼兒至國小低年級",
    summary: "用樂高做出會動的作品，在玩的過程裡認識齒輪、槓桿與力的方向。",
    tags: ["動力機械", "主題課程"],
    image: "/images/f1.webp",
  },
  {
    name: "3D 造物體驗工作坊",
    audience: "國小三年級以上",
    summary: "半日工作坊，從設計到列印，帶走一件自己設計的作品，例如冰箱貼、機關公仔。",
    tags: ["半日體驗", "帶回作品"],
  },
  {
    name: "3D 列印寒暑假營隊",
    audience: "國小三年級以上",
    summary: "連續多天的主題專題，例如「我的微縮城市計畫」「桌遊嘉年華」「飆速遙控計畫」，最後舉辦成果發表。",
    tags: ["寒暑假", "專題", "成果發表"],
  },
];

export const schoolServices = [
  { title: "入校 STEAM 課程", text: "依學校課表與年段設計 LEGO、機器人或 3D 造物課程，可搭配校內設備。" },
  { title: "社團與營隊", text: "學期社團、寒暑假營隊，提供教材、教案與師資。" },
  { title: "親子館與機構活動", text: "托育資源中心、親子館的積木故事屋與主題活動，已在新竹、彰化等地合作。" },
  { title: "客製化專案", text: "競賽培訓、成果發表、3D 列印客製獎品等專案合作。" },
];

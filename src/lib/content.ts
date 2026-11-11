// 官網內容集中在這裡。第一版先寫死，之後改成從 Supabase 的 courses / classes 表讀取，
// 各頁面不用改，只要換掉這支檔案的資料來源。

export const site = {
  name: "玩學院",
  nameEn: "Play Collegeee",
  // 品牌標語（2026-11-10 定案，不要自行改寫）：版面夠用完整版，空間小用精簡版
  tagline: "帶著孩子在玩樂當中，發現屬於自己的超能力，遇見那個閃閃發亮的自己",
  taglineShort: "透過玩，發現超能力，遇見閃閃發亮的自己",
  city: "台中",
  email: "playcollegeee@gmail.com",
  line: "", // TODO: LINE 官方帳號連結
  facebook: "https://www.facebook.com/profile.php?id=61578868228214",
  instagram: "https://www.instagram.com/play_collegeee/",
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
  imageW?: number;
  imageH?: number;
  imageAlt?: string;
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
    topics: ["積木建構與空間概念", "齒輪、滑輪、連桿等動力機械", "LEGO SPIKE Prime／EV3 機器人", "感測器、馬達與控制", "圖像化程式，玩家班進階到 Python", "機器人任務、競賽與自主專題"],
    path: [
      { level: "玩寶", text: "積木操作、故事建構、簡單機械體驗" },
      { level: "玩童", text: "基礎建構、機械概念、簡單邏輯與任務" },
      { level: "玩樂", text: "動力機械、感測器、機器人及程式入門" },
      { level: "玩創", text: "進階機器人、工程設計、程式控制及專題" },
      { level: "玩家", text: "進階機器人、Python、競賽或自主專題" },
    ],
    image: "/images/catapult.webp",
    imageW: 640,
    imageH: 478,
    imageAlt: "樂高主修作品範例：投石機",
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
    image: "/images/city-modeling.webp",
    imageW: 1100,
    imageH: 825,
    imageAlt: "3D 造物主修上課情形：用電腦做 3D 建模",
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
    image: "/images/story-ship.webp",
  },
  {
    name: "樂高動滋動",
    audience: "幼兒至國小低年級",
    summary: "用樂高做出會動的作品，在玩的過程裡認識齒輪、槓桿與力的方向。",
    tags: ["動力機械", "主題課程"],
    image: "/images/lego-car.webp",
  },
  {
    name: "3D 造物體驗工作坊",
    audience: "國小三年級以上",
    summary: "半日工作坊，從設計到列印，帶走一件自己設計的作品，例如冰箱貼、機關公仔。",
    tags: ["半日體驗", "帶回作品"],
    image: "/images/print-proud.webp",
  },
  {
    name: "3D 列印寒暑假營隊",
    audience: "國小三年級以上",
    summary: "連續多天的主題專題，例如「我的微縮城市計畫」「桌遊嘉年華」「飆速遙控計畫」，最後舉辦成果發表。",
    tags: ["寒暑假", "專題", "成果發表"],
    image: "/images/boardgame.webp",
  },
];

export const schoolServices = [
  { title: "入校 STEAM 課程", text: "依學校課表與年段設計 LEGO、機器人或 3D 造物課程，可搭配校內設備。" },
  { title: "社團與營隊", text: "學期社團、寒暑假營隊，提供教材、教案與師資。" },
  { title: "親子館與機構活動", text: "托育資源中心、親子館的積木故事屋與主題活動，已在新竹、彰化等地合作。" },
  { title: "客製化專案", text: "競賽培訓、成果發表、3D 列印客製獎品等專案合作。" },
];

// ---------- 首頁加強區塊（參考常見教育品牌網站的版面手法，內容皆為玩學院真實資料） ----------

// 頂部公告列：有新活動時改這裡；text 留空就不顯示
export const announcement = {
  // 手機只顯示一行，重點放前面
  text: "新朋友入門課「積木故事屋」：3–6 歲親子，每月新主題",
  href: "/contact",
  cta: "立即預約",
};

// 為什麼選玩學院（三欄價值主張）
export const valueProps = [
  { title: "先探索", text: "LEGO、3D 造物、美術與多元選修，孩子不必一開始就決定方向。", color: "yellow" },
  { title: "再深入", text: "五個成長階段、清楚的進階路徑，找到興趣後可以一路往上學。", color: "green" },
  { title: "看得見成長", text: "每一期都有作品與學習紀錄，未來還有專屬角色記錄孩子的每一步。", color: "blue" },
] as const;

// 首屏照片（手機版顯示在大標下方）
export const heroPhoto = { src: "/images/story-ship.webp", alt: "積木故事屋：老師帶孩子一起完成作品", w: 1100, h: 825 };

// 主打課程卡
export const featured = {
  name: "積木故事屋",
  summary: "從繪本故事出發，親子一起動手拼出主題作品，再進入任務挑戰。第一次來玩學院，最推薦從這裡開始。",
  facts: [
    { label: "適合年齡", value: "3–6 歲" },
    { label: "課程時間", value: "60–70 分鐘" },
    { label: "形式", value: "親子同行" },
  ],
  image: "/images/story-ship.webp",
  href: "/contact?type=trial",
};

// 成果與活動紀錄（之後可連到部落格文章）
export const highlights = [
  { date: "2026・夏", title: "3D 列印夏令營：桌遊嘉年華", text: "孩子自己設計規則、建模、列印配件，完成一套能玩的桌遊。", color: "red", image: "/images/build-focus.webp" },
  { date: "2026・6 月", title: "飆速遙控計畫", text: "三天工作坊從設計車殼到組裝遙控車，最後挑戰駕照關卡並舉辦成果發表。", color: "green", image: "/images/rc-car.webp" },
  { date: "2026・冬", title: "我的微縮城市計畫", text: "每個孩子設計一棟建築，最後拼成一座 3D 列印的微縮城市。", color: "blue", image: "/images/city-modeling.webp" },
] as const;

// 數據：只放查得到依據的數字，更新時一起改
export const stats = [
  { value: "1500+", label: "位孩子參加過我們的課程與活動" },
  { value: "5", label: "成長階段，從幼兒園到國高中" },
  { value: "3", label: "開課城市：台中・新竹・彰化" },
];

// 興趣任務入口：家長不必先懂課程名稱，從孩子喜歡什麼開始找
export const interestQuests = [
  { emoji: "⚙️", title: "喜歡拆裝、讓東西動起來", text: "齒輪、機關、會跑的車", href: "/courses#lego", color: "red" },
  { emoji: "🤖", title: "想讓機器人聽話", text: "感測器、馬達、寫程式", href: "/courses#lego", color: "blue" },
  { emoji: "🖨️", title: "腦中有點子想做出來", text: "3D 建模、列印自己的玩具", href: "/courses#3d", color: "green" },
  { emoji: "🎨", title: "愛畫畫、愛做造型", text: "色彩、構圖、立體創作", href: "/courses#art", color: "yellow" },
  { emoji: "📖", title: "年紀還小，想先玩玩看", text: "親子積木故事屋", href: "/workshops", color: "yellow" },
] as const;

// 找課小測驗
export const quiz = {
  grades: [
    { label: "幼兒園", level: "wanbao" },
    { label: "國小一、二年級", level: "wantong" },
    { label: "國小三～五年級", level: "wanle" },
    { label: "國小六年級～國二", level: "wanchuang" },
    { label: "國三以上", level: "wanjia" },
  ],
  likes: [
    { label: "組裝會動的東西", major: "lego" },
    { label: "設計自己的玩具或作品", major: "3d" },
    { label: "畫畫、做造型", major: "art" },
    { label: "還不確定，都想試試", major: "" },
  ],
} as const;

// 作品與活動照片牆
export const gallery = [
  { src: "/images/story-ship.webp", alt: "積木故事屋：小小釣手", w: 1100, h: 825 },
  { src: "/images/lego-car.webp", alt: "樂高動滋動：完成自己的風帆車", w: 825, h: 1100 },
  { src: "/images/print-proud.webp", alt: "3D 造物：拿著自己列印的作品", w: 825, h: 1100 },
  { src: "/images/halloween.webp", alt: "萬聖節積木派對", w: 1100, h: 825 },
  { src: "/images/rc-car.webp", alt: "飆速遙控計畫：駕照關卡", w: 825, h: 1100 },
  { src: "/images/city-modeling.webp", alt: "微縮城市計畫：3D 建模中", w: 1100, h: 825 },
];

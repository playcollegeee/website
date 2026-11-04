// 個資同意書：版本與告知內容（官網報名表、後台建檔共用）。
// 同意書改版時：改 CONSENT_VERSION 與下面的內容，並同步更新紙本同意書。

export const CONSENT_VERSION = "2026-11";

// 預設「都可公開」（2026-11-04 使用者決定）：報名表預先選好，家長不同意可改選或之後告知
export const DEFAULT_PHOTO_SCOPE = "all";
export const PHOTO_SCOPES = [
  { value: "all", label: "作品與上課照片都可公開（預設）", hint: "放在官網與社群分享學習成果，公開時不寫孩子的全名" },
  { value: "works", label: "只公開作品", hint: "作品照片可公開，不放孩子的臉" },
  { value: "none", label: "都不公開", hint: "只用在給家長的學習紀錄" },
] as const;
export const PHOTO_SCOPE_LABEL: Record<string, string> = Object.fromEntries(PHOTO_SCOPES.map((p) => [p.value, p.label]));

// 個資法第 8 條告知事項（精簡版，完整版見紙本同意書）
export const CONSENT_NOTICE: { title: string; body: string }[] = [
  { title: "蒐集者", body: "玩學院 Play Collegeee（短期補習班立案申請中），台中市北屯區四平路 258 巷 15 號，playcollegeee@gmail.com。" },
  { title: "蒐集目的", body: "課程報名、教學與出席管理、學習紀錄與報告、家長聯繫與接送安全、收費與帳務。勾選同意時，另用於寄送課程與活動訊息。上課照片與作品預設會分享在官網與社群（不寫全名），不同意請在下方改選，或之後隨時告訴我們。" },
  { title: "蒐集的資料", body: "孩子姓名、角色暱稱、階段、出生年、就讀學校；家長姓名、關係、電話、Email；出席與刷卡紀錄；家長選填的照護注意事項。不蒐集身分證字號。" },
  { title: "期間、地區、對象、方式", body: "保存至孩子最後一期課程結束後 2 年（帳務資料依稅法保存）。資料存放於雲端服務（含境外主機），僅玩學院老師、行政人員與受託處理的系統、金流、訊息服務商在必要範圍內使用，不提供給其他家長或合作單位。" },
  { title: "您的權利", body: "可隨時查詢、閱覽、取得複本、補充更正、停止使用或刪除，請以 Email 或到教室提出，我們於 15 日內回覆。" },
  { title: "不提供的影響", body: "孩子姓名、階段與家長電話為報名與接送安全所必需，未提供將無法完成報名；其他選填項目不影響上課。" },
];

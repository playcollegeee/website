# 玩學院整合系統：給 Claude 的專案說明

每次開新對話接手這個專案時，先讀這份檔案。用繁體中文（台灣用語）與使用者溝通。

## 這是什麼

至聖文教事業有限公司旗下「玩學院 Play Collegeee」（台中兒童 STEAM 教室，創辦人阿智老師）的官網，之後會擴充成整合系統：
官網、簽到（NFC／QR 卡）、課程報名與點數金流、課程教案庫、學生資料庫與遊戲角色養成、AI Agent 行政自動化。

- 開發藍圖（Claude Docs）：https://claude.ai/artifact/AuHQqrUHG8Tyy8w7wzqUwT
- 正式網址：https://playcollegeee.com（www 會 308 轉到主網域）
- 預覽網址：https://website-psi-amber-10.vercel.app

## 帳號與服務

| 服務 | 帳號／位置 | 備註 |
| --- | --- | --- |
| GitHub | 個人帳號 `chisheng-edu`（chishengca@gmail.com），組織 `playcollegeee`，程式庫 `playcollegeee/website`（公開） | 後台、教案等敏感程式建議另開私人程式庫 |
| Vercel | 團隊 `playcollegeee`（Hobby），專案 `website` | 推到 `main` 自動部署；正式商業使用前要升級 Pro |
| Supabase | 組織 `playcollegeee`，專案 `playcollegeee`（ref `vwldlojnnkttwoawlbog`，孟買，Free） | 環境變數 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（sb_secret_）只放在 Vercel |
| 網域 | hosting.com 註冊 playcollegeee.com，DNS 在 hosting.com | A @ → 216.198.79.1；CNAME www → Vercel；信箱相關紀錄不要動 |
| 舊站 | hosting.com 上被入侵的 WordPress | 2026/11/04 已刪除；主機合約到 2027/12 |
| 對外信箱 | playcollegeee@gmail.com | FB、IG 連結在 `src/lib/content.ts` |

## 已確認的品牌與課程制度（不可自行更改）

- 五階段分班：玩寶（幼幼～大班）、玩童（小一～二）、玩樂（小三～五）、玩創（小六～國二）、玩家（國三以上）
- 三大主修：LEGO 樂高建構與機器人、3D 列印與造物（小三以上）、美術與視覺創作；一期一選，期末可續讀或更換
- 探索選修用統一點數制（1 點 = NT$100 為初步，未定案）；主修按期收費，不用點數
- 品牌色：黃 #FBC20F、綠 #5CBEAA、紅 #EA5754、藍 #5098D2
- 價格、堂數、人數上限都還是初步試算，網站上不要公開未定案的價格
- 合作單位名單暫不公開

## 技術

- Next.js 16（App Router）＋ TypeScript，純 CSS（`src/app/globals.css`），沒有 Tailwind
- 特效全部自己寫、不加套件：`BrickPlayground`（首頁積木雨，凸點格線物理）、`StackingLevels`（捲動疊積木階梯）、`src/lib/confetti.ts`（彩色紙片）
- 所有動畫都要尊重 `prefers-reduced-motion`
- 資料庫結構在 `supabase/migrations/`；目前只有 `0001_init.sql`（已在 Supabase 執行）。新的變更一律新增 migration 檔，不要直接改線上資料表
- 核心設計：`attendance`（上課紀錄）是核心事件，觸發器自動發放裝備與經驗值；點數一律寫 `point_ledger` 流水帳

## 開發注意事項

- 這個雲端環境連不到 npm，無法 `npm install` 或 `next build`。驗證方式：
  1. 用 `/opt/npm-tools/node_modules/.bin/esbuild` 檢查語法，並把頁面打包成靜態 HTML，用 Playwright 截圖檢查畫面與互動
  2. 推到 GitHub 後用 `gh api repos/playcollegeee/website/commits/main/status` 確認 Vercel 編譯成功
  3. Postgres 16 可在本機啟動，用來測試 migration（需自建 `auth.users`、`auth.uid()` 替身）
- commit 作者用 `chisheng-edu <chishengca@gmail.com>`，程式註解用繁體中文
- 兒童個資：公開頁面只顯示角色暱稱；照片要家長同意才公開；所有資料表開 RLS
- 金鑰、密碼不可寫進程式或貼到網站欄位；需要時請使用者自己貼到 Vercel
- 刪除資料、刪除網站、改 DNS 等不可逆操作，執行前一定先問使用者

## 專案知識檔

claude.ai 專案「玩學院系統開發」裡有「玩學院系統開發_現況總整理」。有進度、決定或帳號變動時，要同步更新那份檔案。

## 待辦（依優先順序）

1. 表單新詢問通知（Email 或 LINE）、簡單的後台詢問列表
2. 11/18 提醒：設定 Google Search Console 並提交 sitemap
3. 學生／家長資料庫與簽到 MVP（見開發藍圖第 2 階段）

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
| 網域 | hosting.com 註冊 playcollegeee.com（2027/09/12 到期，要續約） | 2026/11/04 起 Nameserver 是 Vercel，DNS 紀錄在 Vercel 團隊 Domains 頁管理（含 MX、mail A、SPF TXT） |
| 舊站 | hosting.com WP Plus 主機 | WordPress 2026/11/04 已刪除；主機要取消續約（到期 2027/09/12） |
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
- 頁面分組：官網各頁在 `src/app/(site)/`（有頁首頁尾）；後台 `src/app/admin/`、登入 `src/app/login/`、讀卡站 `src/app/kiosk/` 不套官網外框
- 老師登入：每位老師一個帳號，帳密交給 Supabase Auth 驗證（`/auth/v1/token`，用 fetch 呼叫，沒有裝 supabase-js），成功後發自簽 cookie `pc_staff`（`src/lib/session.ts`，HMAC 金鑰由 service key 推導，12 小時）。`src/proxy.ts` 擋 `/admin`；每個頁面與 server action 開頭都要呼叫 `requireStaff()`（管理員限定用 `requireStaff(true)`），它會回資料庫確認老師仍在職。老師資料在 `teachers` 表，用 `email` 對應登入帳號
- 讀卡站：`/kiosk` 頁面（USB 鍵盤式讀卡機＋Android Web NFC）與 `/api/checkin`（平板用 cookie `pc_kiosk`、ESP32 用 `Authorization: Bearer 金鑰`），`devices` 表只存金鑰 SHA-256。簽到邏輯全部在資料庫函式 `checkin_by_card()`，每次刷卡寫 `card_scans`
- 卡片建議 13.56 MHz NTAG213／215；卡號統一去冒號轉大寫（`normalizeUid` 與 SQL 規則一致）
- Supabase 呼叫統一用 `src/lib/supabase.ts`（`sbGet`、`sbInsert`、`sbPatch`、`sbRpc`、`audit`）；每次寫入都呼叫 `audit()` 寫操作紀錄
- 分享預覽圖：各路由資料夾的 `opengraph-image.jpg`（1200×630）
- 資料庫結構在 `supabase/migrations/`：`0001_init.sql`（已執行）、`0002_students_checkin.sql`（學生多家長、同意紀錄、讀卡站、簽到函式）。新的變更一律新增 migration 檔，不要直接改線上資料表
- 核心設計：`attendance`（上課紀錄）是核心事件，觸發器自動發放裝備與經驗值；點數一律寫 `point_ledger` 流水帳

## 開發注意事項

- 驗證方式（2026-11-04 起雲端環境可以 `npm install`，請先試；不行再用 esbuild 檢查語法）：
  1. `npm install && npx next build`（會跑 TypeScript 檢查）；不要把 package-lock.json 和 tsconfig 的自動修改提交
  2. 端對端測試：本機 Postgres＋PostgREST（GitHub releases 下載 static 版）＋一個模擬 Supabase Auth 的小 node 伺服器，`next start` 後用 Playwright 走流程、截圖
  3. 推到 GitHub 後用 `gh api repos/playcollegeee/website/commits/main/status` 確認 Vercel 編譯成功
  4. Postgres 16 可在本機啟動，用來測試 migration（需自建 `auth.users`、`auth.uid()` 替身）
- commit 作者用 `chisheng-edu <chishengca@gmail.com>`，程式註解用繁體中文
- 兒童個資：公開頁面只顯示角色暱稱；照片要家長同意才公開；所有資料表開 RLS
- 金鑰、密碼不可寫進程式或貼到網站欄位；需要時請使用者自己貼到 Vercel
- 刪除資料、刪除網站、改 DNS 等不可逆操作，執行前一定先問使用者

## 專案知識檔

claude.ai 專案「玩學院系統開發」裡有「玩學院系統開發_現況總整理」。有進度、決定或帳號變動時，要同步更新那份檔案。

## 待辦（依優先順序）

1. DNS 生效後取消 WP 主機續約（`ADMIN_PASSWORD` 已不再使用，改成老師帳號登入）
2. LINE 官方帳號連結（使用者辦理中）
3. 11/18 提醒：設定 Google Search Console 並提交 sitemap
4. 第 2 階段（學生資料庫＋簽到）程式已完成，待使用者執行 0002 migration、建立第一個管理員帳號、買讀卡機與 NTAG 卡實測
5. 之後：LINE 到校通知、ESP32 讀卡機韌體、卡片寫入角色頁網址、家長同意書線上版

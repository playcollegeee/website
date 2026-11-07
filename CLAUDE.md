# 玩學院整合系統：給 Claude 的專案說明

每次開新對話接手這個專案時，先讀這份檔案。用繁體中文（台灣用語）與使用者溝通。

## 這是什麼

至聖文教事業有限公司旗下「玩學院 Play Collegeee」（台中兒童 STEAM 教室，創辦人阿智老師）的官網，之後會擴充成整合系統：
官網、簽到（NFC／QR 卡）、課程報名與點數金流、課程教案庫、學生資料庫與遊戲角色養成、AI Agent 行政自動化。

- 開發藍圖：以 claude.ai 專案文件「玩學院系統開發_開發藍圖」v0.3 為準（舊版 v0.1：https://claude.ai/artifact/AuHQqrUHG8Tyy8w7wzqUwT）；角色養成、教案庫各有專案文件
- 正式網址：https://playcollegeee.com（www 會 308 轉到主網域）
- 預覽網址：https://website-psi-amber-10.vercel.app

## 帳號與服務

| 服務 | 帳號／位置 | 備註 |
| --- | --- | --- |
| GitHub | 個人帳號 `chisheng-edu`（chishengca@gmail.com），組織 `playcollegeee`，程式庫 `playcollegeee/website`（公開） | 後台、教案等敏感程式建議另開私人程式庫 |
| Vercel | 團隊 `playcollegeee`（Hobby），專案 `website` | 推到 `main` 自動部署；正式商業使用前要升級 Pro |
| Supabase | 組織 `playcollegeee`，專案 `playcollegeee`（ref `vwldlojnnkttwoawlbog`，孟買，Free） | 環境變數 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（sb_secret_）只放在 Vercel |
| 網域 | hosting.com 註冊 playcollegeee.com（2027/09/12 到期，要續約） | 2026/11/04 起 Nameserver 是 Vercel，DNS 紀錄在 Vercel 團隊 Domains 頁管理（含 MX、mail A、SPF TXT） |
| 舊站 | hosting.com WP Plus 主機 | WordPress 2026/11/04 已刪除；2026/11/05 已送出取消申請（工單 SAW-470-85183，到期 2027/09/12 再停；網域保留） |
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
- 首頁角色試玩：`src/components/AvatarCreator.tsx`（2026-11-06 改成戰棋像素風：`public/avatar/` 的 64×64 PNG 圖層依序疊出角色，放大 5 倍用 `image-rendering: pixelated`；見習職業可捏膚色／髮型／髮色／表情，「完成期數」0–5 解鎖裝備；每條路線 6 種轉職只顯示剪影＋名稱 `sil_*.png`，不在官網露出造型。圖層目前是程式畫的參考稿，正式美術外包後直接替換同名檔案。規則為示意，純前端不存資料；設計見專案文件「玩學院角色養成_設計規劃」）
- 官網照片：首頁「成果紀錄」「教室現場」讀 `site_photos`（`src/lib/sitePhotos.ts`，tag `site-photos` 快取一小時，讀不到資料表就用 `content.ts` 內建照片）；後台 `/admin/photos` 上傳到 Storage 公開 bucket `site-photos`（瀏覽器先縮圖 1600px WebP，`next.config.ts` 的 serverActions bodySizeLimit 4mb）；存檔呼叫 `updateTag("site-photos")`
- 所有動畫都要尊重 `prefers-reduced-motion`
- 資安（2026-11-06）：`next.config.ts` 有 CSP／Permissions-Policy／COOP（新增外部服務要把網域加進 CSP；定位只開給本站線上打卡）；公開表單、登入、讀卡站用 `src/lib/rateLimit.ts` 的 `allow()` 做次數限制（`rate_limits` 表，migration 0006，表不存在時放行）；`/api/health` 給監控用；`.github/workflows/uptime.yml` 每 30 分鐘監控、失敗開 Issue；`.github/dependabot.yml` 每週檢查套件。詳見專案文件「玩學院系統開發_資安與維運計畫」
- 後台選單：`src/app/admin/layout.tsx` 的 `groups` 分五類（每天上課／學生與家長／課程／招生與官網／系統設定），`AdminNav.tsx` 桌機側邊欄、手機「☰ 選單」；新頁面要放進分類
- 頁面分組：官網各頁在 `src/app/(site)/`（有頁首頁尾）；後台 `src/app/admin/`、登入 `src/app/login/`、讀卡站 `src/app/kiosk/` 不套官網外框
- 老師登入：每位老師一個帳號，帳密交給 Supabase Auth 驗證（`/auth/v1/token`，用 fetch 呼叫，沒有裝 supabase-js），成功後發自簽 cookie `pc_staff`（`src/lib/session.ts`，HMAC 金鑰由 service key 推導，12 小時）。`src/proxy.ts` 擋 `/admin`；每個頁面與 server action 開頭都要呼叫 `requireStaff()`（管理員限定用 `requireStaff(true)`），它會回資料庫確認老師仍在職。老師資料在 `teachers` 表，用 `email` 對應登入帳號
- 讀卡站：`/kiosk` 頁面（USB 鍵盤式讀卡機＋Android Web NFC）與 `/api/checkin`（平板用 cookie `pc_kiosk`、ESP32 用 `Authorization: Bearer 金鑰`），`devices` 表只存金鑰 SHA-256。簽到邏輯全部在資料庫函式 `checkin_by_card()`，每次刷卡寫 `card_scans`
- 線上新生報名：官網 `/enroll` → `/api/enroll` 寫入 `registration_requests`（待審核）→ 後台 `/admin/registrations` 審核建檔。個資告知文字與同意書版本在 `src/lib/consent.ts`（`CONSENT_VERSION`），紙本同意書在 Claude Docs：https://claude.ai/artifact/YCKtwhW4tq3vubGJ3sQ7j5
- 老師打卡：教室刷卡（`checkin_by_card`）與線上打卡（後台首頁 `timesheet/PunchCard.tsx`，外派地點用，記地點與選填的手機定位）共用 `teacher_attendance`，`source`／`check_out_source` 記方式（card／online／manual）；超過 16 小時未下班視為忘記打卡（`OPEN_WINDOW_HOURS`）。`/admin/timesheet` 月報表，管理員可修改與補登（寫 `edited_by`）。注意 `teacher_attendance` 有兩個指向 teachers 的外鍵，嵌入時要寫 `teachers!teacher_attendance_teacher_id_fkey(...)`
- 課程教案庫（2026-11-06 第 1 批，migration 0007）：教案（`lessons`）不再綁某個 `courses`，改掛 `lesson_categories`（主修→類別，管理員在 `/admin/lesson-settings` 改名、排序、停用），標籤詞庫 `tags`（kind：theme 主題／structure 結構／code 程式／technique 技巧／knowledge 知識；skill 技能 2026-11-07 拿掉，舊資料保留但畫面不顯示）＋`lesson_tags`。教學流程存在 `lessons.timeline` `[{phase: intro|main|wrap, min, title, teacher, students}]`、器材 `materials` `[{name, qty}]`。搜尋用資料庫函式 `search_lessons()`（關鍵字比對 `search_text` 產生欄位＋標籤名稱，pg_trgm 索引），合併同義標籤用 `merge_tags()`，兩者只有伺服器能呼叫。只有作者或管理員能改教案（`canEditLesson`）。頁面：`/admin/lessons`（列表搜尋）、`/new`、`/[id]`（可列印）、`/[id]/edit`；班級頁每堂旁的 `classes/LessonPicker.tsx` 選教案（用 transition 直接呼叫 `setSessionLesson`，避免 `<form action>` 送出後 React 把 select 重設）。共用常數在 `src/lib/lessons.ts`
- 教案照片與 .io（2026-11-07，migration 0008）：檔案放私人 bucket `lesson-files`（`LESSON_BUCKET`），資料在 `lesson_files`（kind：image／model_io，`thumb_path` 縮圖、`is_cover` 封面、`uploaded_by`）。照片在瀏覽器先縮成 1600px＋480px 縮圖（`src/lib/imageShrink.ts`、`lessons/uploadClient.ts`），再用 server action 上傳（`lessons/fileActions.ts`，回傳 `{ok,message}`）；頁面用 `sbSignUrls()` 產生 1 小時連結顯示，下載走 `/admin/lessons/file/[id]`（確認老師後轉 60 秒連結）。所有老師可上傳；刪除、換封面限上傳者／作者／管理員。管理員工具 `/admin/lessons/import-files`：選電腦資料夾，依子資料夾名稱對應教案，批次上傳照片與 .io（同名檔略過，可重複執行）。步驟圖 PDF 不上傳（使用者決定）。端對端測試時資料夾選擇與 `setInputFiles` 在無頭 Chrome 會卡住，改用 DataTransfer 塞檔案；下載檔名在測試瀏覽器會顯示 download（環境問題）
- AI 教案初稿與匯出（2026-11-07，migration 0009）：`src/lib/ai.ts` 用 fetch 呼叫 Claude API（`ANTHROPIC_API_KEY` 只放 Vercel；模型 `ANTHROPIC_MODEL`，預設 claude-sonnet-5-5；版本標頭 2026-10-21，不可送 temperature；Sonnet 5.5 不支援強制指定工具，改用 strict 工具＋tool_choice auto，schema 每個 object 要 additionalProperties: false 且欄位全列 required；thinking 設 between_tools，400 時自動拿掉 thinking 重試；錯誤會顯示 Claude 回傳的原因）。`lessons/aiActions.ts` 兩個用途，都不直接寫資料庫：`draftLesson()` 是表單的「協助整理」（補簡介、器材、差異化、常見卡關、標籤）；`draftCollab()` 是教案頁的「合作單位版」（`CollabPack.tsx`，學習目標、三段流程、給家長的話、活動簡介，需要時才產生，用 `saveCollab` 儲存，所有老師可存）。2026-11-07 使用者決定：這些欄位只有幼兒課給親子館等合作單位時才用，所以不放在教案主表單；每位老師 1 小時 30 次（`LIMITS.ai`）。教案新欄位 `parent_note`（給家長的話）、`outline`（活動簡介）。匯出 Word（放在合作單位版區塊）：`/admin/lessons/[id]/export/[a|b|c]`，三種外部單位表格（`src/lib/lessonExport.ts`），`src/lib/docx.ts` 自己組 docx（不壓縮 zip，不用套件）。合作單位名稱不要寫進程式或註解（程式庫公開）。本機測試可設 `ANTHROPIC_BASE_URL` 指向模擬伺服器
- 卡片建議 13.56 MHz NTAG213／215；卡號統一去冒號轉大寫（`normalizeUid` 與 SQL 規則一致）
- 伺服器地區：`vercel.json` 的 `regions` 設為 `bom1`（孟買），必須和 Supabase 同地區，否則每次查資料都要繞地球；搬資料庫時一起改
- 後台即時回饋：點名用 `sessions/RollButtons.tsx`、詢問狀態用 `leads/LeadStatusForm.tsx`（useOptimistic）；`admin/PendingFeedback.tsx` 讓所有表單送出時按鈕顯示處理中；`admin/loading.tsx` 換頁動畫；`audit()` 用 `after()` 在回應後寫入
- Supabase 呼叫統一用 `src/lib/supabase.ts`（`sbGet`、`sbInsert`、`sbPatch`、`sbRpc`、`audit`）；每次寫入都呼叫 `audit()` 寫操作紀錄
- 分享預覽圖：各路由資料夾的 `opengraph-image.jpg`（1200×630）
- 資料庫結構在 `supabase/migrations/`：`0001_init.sql`（已執行）、`0002_students_checkin.sql`（學生多家長、同意紀錄、讀卡站、簽到函式）、`0003_registrations.sql`（線上報名待審核表、照片公開範圍 `photo_scope`、照護注意事項 `care_notes` 需 `care_consent_at`）、`0004_site_photos.sql`（官網照片表＋Storage bucket）、`0005_teacher_punch.sql`（老師線上打卡欄位）、`0006_rate_limits.sql`（次數限制），`0007_lesson_library.sql`（教案庫：類別、標籤、教案欄位、搜尋與合併函式、出席只發經驗值），0001～0007 都已在正式站執行（0007 於 2026-11-06）；`0008_lesson_files.sql`（教案照片與 .io、私人 bucket）2026-11-07 已執行；`0009_lesson_ai_export.sql`（給家長的話、活動簡介、搜尋文字重建）2026-11-07 已執行。新的變更一律新增 migration 檔，不要直接改線上資料表
- 核心設計：`attendance`（上課紀錄）是核心事件，觸發器自動發經驗值（讀該堂教案的 `lessons.xp`，沒有教案給 10）；0007 起不再每堂發裝備，裝備改成期末發放（角色養成系統處理，`lesson_rewards` 暫留未用）。學生上過哪些教案＝出席紀錄＋該堂 `sessions.lesson_id`；點數一律寫 `point_ledger` 流水帳

## 開發注意事項

- 驗證方式（2026-11-04 起雲端環境可以 `npm install`，請先試；不行再用 esbuild 檢查語法）：
  1. `npm install && npx next build`（會跑 TypeScript 檢查）；不要把 package-lock.json 和 tsconfig 的自動修改提交
  2. 端對端測試：本機 Postgres＋PostgREST（GitHub releases 下載 static 版）＋一個模擬 Supabase Auth 的小 node 伺服器，`next start` 後用 Playwright 走流程、截圖（Chrome 在 `/usr/bin/google-chrome`；同一帳號登入超過 8 次會被次數限制擋，測試時清空 `rate_limits`；重新編譯後要先結束舊的 `next-server` 程序，否則新的伺服器起不來、測到的是舊版）
  3. 推到 GitHub 後用 `gh api repos/playcollegeee/website/commits/main/status` 確認 Vercel 編譯成功
  4. Postgres 16 可在本機啟動，用來測試 migration（需自建 `auth.users`、`auth.uid()` 替身）
- commit 作者用 `chisheng-edu <chishengca@gmail.com>`，程式註解用繁體中文
- 兒童個資：公開頁面只顯示角色暱稱；照片要家長同意才公開；所有資料表開 RLS
- 金鑰、密碼不可寫進程式或貼到網站欄位；需要時請使用者自己貼到 Vercel
- 刪除資料、刪除網站、改 DNS 等不可逆操作，執行前一定先問使用者

## 專案知識檔

claude.ai 專案「玩學院系統開發」裡有「玩學院系統開發_現況總整理」。有進度、決定或帳號變動時，要同步更新那份檔案。

## 待辦（依優先順序）

1. 使用者開兩步驟驗證（0006 已執行、GitHub 安全掃描已開，2026-11-06）；留意 hosting.com 取消工單回覆
2. LINE 官方帳號連結（使用者辦理中）
3. 11/18 提醒：設定 Google Search Console 並提交 sitemap
4. 第 2 階段已上線，待買讀卡機與 NTAG 卡實測
5. 官網照片共享：建議先用 Google 雲端硬碟共用資料夾，之後在後台做私人「照片庫」（老師上傳、推薦、管理員一鍵上官網）；待使用者決定
6. 課程教案庫：第 1 批已上線（PR #8）；第 2 批照片與 .io 已上線（PR #9）。第 3 批 AI 初稿與匯出 Word 已上線（PR #10、#11）；簡化成合作單位版（PR #12）。下一步：規劃頁（季主題、月份主題、冬夏令營）→ 會議錄音整理 → 版本紀錄、複製成自己的版本
7. 之後：LINE 到校通知、ESP32 讀卡機韌體、卡片寫入角色頁網址、家長同意書線上版

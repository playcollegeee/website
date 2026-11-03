# 玩學院 Play Academy 官網與整合系統

至聖文教事業有限公司・玩學院的官網，之後會逐步擴充成簽到、報名、教案庫、學生角色養成與 AI 行政系統。

## 技術

- **Next.js 16**（App Router）＋ TypeScript，部署在 **Vercel**
- **Supabase**（PostgreSQL、登入、檔案儲存）
- 樣式：純 CSS（`src/app/globals.css`），品牌四色取自 logo

## 目錄

| 路徑 | 內容 |
| --- | --- |
| `src/lib/content.ts` | 官網文字與課程資料（五階段、三大主修、活動）。改文案從這裡改 |
| `src/app/` | 各頁面：首頁、課程、活動、學校合作、關於、聯絡 |
| `src/app/api/trial/route.ts` | 試聽／諮詢表單，寫入 Supabase `leads` 表 |
| `src/components/AvatarPreview.tsx` | 角色養成示意圖（之後改為讀學生真實裝備） |
| `supabase/migrations/0001_init.sql` | 資料庫第一版：學生、課程、出席、點數流水帳、角色裝備 |
| `public/brand`、`public/images` | logo 與作品圖片 |

## 本機開發

```bash
npm install
cp .env.example .env.local   # 填入 Supabase 網址與金鑰
npm run dev                  # 打開 http://localhost:3000
```

## 部署

推到 GitHub `main` 分支後，Vercel 會自動部署。環境變數在 Vercel → Project → Settings → Environment Variables 設定：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`（只放在 Vercel，不要寫進程式或傳給別人）

## 資料庫

在 Supabase → SQL Editor 執行 `supabase/migrations/0001_init.sql`。設計原則：

1. `attendance`（上課紀錄）是核心事件，新增一筆就自動發放該堂教案設定的裝備與經驗值
2. 點數一律寫進 `point_ledger` 流水帳，餘額看 `point_balances`
3. 所有表都開啟 RLS；家長只看得到自己孩子的資料，公開頁面只顯示角色暱稱

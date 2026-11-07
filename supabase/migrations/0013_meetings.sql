-- 玩學院整合系統：會議紀錄（手機錄音匯入 → 語音轉文字 → AI 摘要、決議、待辦）
--   meetings       一場會議（掛在某份課程規劃底下）
--   meeting_parts  錄音切成小段後，每一段的逐字稿（錄音檔本身不保存，只留文字）
-- 需要先執行 0012（課程規劃）。在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。

begin;

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans (id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  held_on date,
  status text not null default 'transcribing' check (status in ('transcribing', 'summarizing', 'ready', 'failed')),
  parts_total int not null default 0 check (parts_total between 0 and 400),
  duration_sec int,
  summary text,                       -- AI 摘要（老師可再修改）
  ai_result jsonb,                    -- AI 整理的決議、待辦、待討論事項（給老師挑選套用）
  applied_at timestamptz,             -- 已把決議、待辦套用到規劃的時間
  consent_note text,                  -- 開錄前已告知與會者的確認
  created_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meetings_plan on meetings (plan_id, held_on desc);

create table if not exists meeting_parts (
  meeting_id uuid not null references meetings (id) on delete cascade,
  idx int not null check (idx >= 0),
  text text not null default '',
  created_at timestamptz not null default now(),
  primary key (meeting_id, idx)
);

-- 只讓後台伺服器（service role）讀寫
alter table meetings enable row level security;
alter table meeting_parts enable row level security;

commit;

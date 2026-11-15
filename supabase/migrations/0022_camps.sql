-- 0022：冬夏令營頁面（官網 /camp，後台「冬夏令營頁面」）
--   camp_seasons   一季營隊（例：2027 冬令營）：頁面文字、頂端選單出現的日期、早鳥、一天流程、Q&A、照片
--   camp_programs  這一季的每一個營隊（一梯一筆，一律全天報名）：
--                  連到「課程規劃」的營隊規劃 plans（每天上午／下午的內容）＋「活動報名」的開課 activity_runs（報名、名額、對帳）
-- 2026-11-15 使用者決定：以梯次報名、一律全天；營隊頁不顯示價格（只在報名頁看）；選單依日期自動出現、也可手動開關；有早鳥優惠
-- 在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。

begin;

create table if not exists camp_seasons (
  id uuid primary key default gen_random_uuid(),
  season text not null check (season in ('winter', 'summer')),     -- 冬令營／夏令營
  year int not null check (year between 2025 and 2100),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),      -- 網址：/camp/2027-winter
  title text not null check (length(title) between 1 and 40),       -- 例：2027 冬令營
  headline text not null default '',                                -- 首屏大標下的一句話
  intro text not null default '',                                   -- 介紹
  cover_url text,
  cover_path text,
  status text not null default 'draft' check (status in ('draft', 'published')),  -- 草稿只有老師能預覽
  menu_mode text not null default 'auto' check (menu_mode in ('auto', 'on', 'off')), -- 頂端選單：依日期／一直顯示／不顯示
  promo_from date,                                                  -- 依日期：從這天開始出現在頂端選單，營隊最後一天過後自動收起
  early_until date,                                                 -- 早鳥截止日（含當天）
  early_text text,                                                  -- 早鳥說明，例：12/15 前完成報名享早鳥優惠（不寫金額）
  day_flow jsonb not null default '[]',                             -- 一天的流程 [{time, title, note}]
  faq jsonb not null default '[]',                                  -- 家長 Q&A [{cat, q, a}]
  bring text not null default '',                                   -- 要帶什麼（一行一項）
  pickup text not null default '',                                  -- 接送與地點說明
  photos jsonb not null default '[]',                               -- 營隊照片 [{url, path, width, height}]（已取得家長同意的照片）
  created_by uuid references teachers (id) on delete set null,
  updated_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, season)
);

create table if not exists camp_programs (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references camp_seasons (id) on delete cascade,
  plan_id uuid references plans (id) on delete set null,            -- 課程規劃（每天上午／下午的內容）
  run_id uuid references activity_runs (id) on delete set null,     -- 活動報名的開課（報名、名額）
  title text not null check (length(title) between 1 and 60),       -- 營隊名稱
  tagline text not null default '',                                 -- 一句話介紹
  major text not null default 'mix' check (major in ('lego', '3d', 'art', 'mix')),  -- 主修：LEGO／3D／美術／跨域
  stages text[] not null default '{}',                              -- 適合的階段：wanbao／wantong／wanle／wanchuang／wanjia
  grade_text text,                                                  -- 適合年級說明，例：國小一～三年級
  highlights text[] not null default '{}',                          -- 營隊重點（一行一點）
  takeaway text,                                                    -- 帶回家的作品
  show_schedule boolean not null default true,                      -- 顯示每天上午／下午的內容（從課程規劃帶出）
  day_overrides jsonb not null default '{}',                        -- 官網上要改寫的每日內容 {"2027-01-25:am": "…"}（空白就用規劃的名稱）
  cover_url text,
  cover_path text,
  sort int not null default 0,
  published boolean not null default true,
  created_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists camp_programs_season on camp_programs (season_id, sort);
-- 一份營隊規劃、一個開課只對應一個營隊
create unique index if not exists camp_programs_plan on camp_programs (plan_id) where plan_id is not null;
create unique index if not exists camp_programs_run on camp_programs (run_id) where run_id is not null;

create or replace function camps_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists camp_seasons_touch on camp_seasons;
create trigger camp_seasons_touch before update on camp_seasons for each row execute function camps_touch();
drop trigger if exists camp_programs_touch on camp_programs;
create trigger camp_programs_touch before update on camp_programs for each row execute function camps_touch();

-- 只有伺服器（service key）讀寫
alter table camp_seasons enable row level security;
alter table camp_programs enable row level security;

commit;

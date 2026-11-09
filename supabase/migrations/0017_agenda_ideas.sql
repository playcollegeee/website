-- 玩學院整合系統：會議議程、點子牆與投票
--   meetings 可以先「安排」（status planned）再匯入錄音；meeting_agenda 是議程（負責人、預計分鐘、會前資料、AI 整理的結論）
--   plan_ideas 點子牆（主題／活動點子／其他，可匿名），plan_votes 投票（每位老師每份規劃最多 3 票，由伺服器檢查）
--   plan_comments.idea_id：對某個點子留意見
-- 在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。

begin;

-- 會議可以先安排、擬議程，之後再匯入錄音
alter table meetings drop constraint if exists meetings_status_check;
alter table meetings add constraint meetings_status_check
  check (status in ('planned', 'transcribing', 'summarizing', 'ready', 'failed'));

create table if not exists meeting_agenda (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  seq int not null default 0,
  title text not null check (length(title) between 1 and 200),
  owner_id uuid references teachers (id) on delete set null,       -- 這個議題由誰說明
  minutes int check (minutes is null or minutes between 1 and 240), -- 預計分鐘
  notes text check (notes is null or length(notes) <= 2000),        -- 會前資料、連結
  result text check (result is null or length(result) <= 2000),     -- 結論（AI 整理後老師可改）
  created_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meeting_agenda_meeting on meeting_agenda (meeting_id, seq);

create table if not exists plan_ideas (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans (id) on delete cascade,
  kind text not null default 'theme' check (kind in ('theme', 'activity', 'other')),
  title text not null check (length(title) between 1 and 80),
  detail text check (detail is null or length(detail) <= 1000),
  anonymous boolean not null default false,                         -- 匿名：畫面上不顯示提案人（資料庫仍記錄，供權限與操作紀錄）
  status text not null default 'open' check (status in ('open', 'adopted', 'dropped')),
  author_id uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan_ideas_plan on plan_ideas (plan_id, created_at);

create table if not exists plan_votes (
  idea_id uuid not null references plan_ideas (id) on delete cascade,
  teacher_id uuid not null references teachers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, teacher_id)
);

alter table plan_comments add column if not exists idea_id uuid references plan_ideas (id) on delete cascade;

-- 只讓後台伺服器（service role）讀寫
alter table meeting_agenda enable row level security;
alter table plan_ideas enable row level security;
alter table plan_votes enable row level security;

commit;

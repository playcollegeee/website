-- 玩學院整合系統：課程規劃（季主題、月份主題、冬夏令營）＋留言、決議、待辦
--   plans          一份規劃：kind season 季主題／month 月份主題／camp 冬夏令營
--   plan_items     規劃內容：季主題的主修 12 堂、走讀課程、工作坊；月份主題的積木故事屋、樂高動滋動場次；營隊每天上午／下午
--   plan_comments  留言串（整份規劃或某一項），可標成「決議」
--   plan_tasks     待辦：指派老師與期限
-- 在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。

begin;

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('season', 'month', 'camp')),
  title text not null check (length(title) between 1 and 80),          -- 主題名稱
  start_date date,
  end_date date,
  status text not null default 'idea' check (status in ('idea', 'discuss', 'final')),  -- 構想／討論中／定案
  summary text,                                                         -- 主題說明、目標
  owner_id uuid references teachers (id) on delete set null,            -- 負責老師
  created_by uuid references teachers (id) on delete set null,
  updated_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists plans_kind on plans (kind, start_date desc);

create table if not exists plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans (id) on delete cascade,
  -- 季主題：major_lego／major_3d／major_art（主修 12 堂）、walk 走讀課程、workshop 工作坊
  -- 月份主題：story 積木故事屋、move 樂高動滋動
  -- 冬夏令營：camp（day＋slot 上午 am／下午 pm）
  section text not null check (section in ('major_lego', 'major_3d', 'major_art', 'walk', 'workshop', 'story', 'move', 'camp')),
  seq int not null default 0,                    -- 主修第幾堂、排序
  day date,
  slot text check (slot is null or slot in ('am', 'pm')),
  title text,                                    -- 活動名稱、場地
  lesson_id uuid references lessons (id) on delete set null,
  teacher_id uuid references teachers (id) on delete set null,
  notes text,                                    -- 流程、材料、注意事項
  updated_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan_items_plan on plan_items (plan_id, section, day, seq);
-- 營隊同一天同一時段只有一筆、主修同一堂只有一筆
create unique index if not exists plan_items_camp_slot on plan_items (plan_id, day, slot) where section = 'camp';
create unique index if not exists plan_items_major_seq on plan_items (plan_id, section, seq) where section like 'major_%';

create table if not exists plan_comments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans (id) on delete cascade,
  item_id uuid references plan_items (id) on delete cascade,     -- null＝整份規劃的討論
  parent_id uuid references plan_comments (id) on delete cascade, -- 回覆
  body text not null check (length(body) between 1 and 3000),
  is_decision boolean not null default false,
  decided_by uuid references teachers (id) on delete set null,
  decided_at timestamptz,
  author_id uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan_comments_plan on plan_comments (plan_id, created_at);

create table if not exists plan_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans (id) on delete cascade,
  title text not null check (length(title) between 1 and 300),
  assignee_id uuid references teachers (id) on delete set null,
  due_date date,
  done_at timestamptz,
  done_by uuid references teachers (id) on delete set null,
  created_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists plan_tasks_assignee on plan_tasks (assignee_id) where done_at is null;
create index if not exists plan_tasks_plan on plan_tasks (plan_id);

-- 只讓後台伺服器（service role）讀寫
alter table plans enable row level security;
alter table plan_items enable row level security;
alter table plan_comments enable row level security;
alter table plan_tasks enable row level security;

commit;

-- 玩學院整合系統：資料庫第一版
-- 原則：上課紀錄（attendance）是核心事件；點數一律記流水帳；兒童個資一律開啟 RLS。
-- 在 Supabase → SQL Editor 貼上執行，或用 supabase CLI 套用。

create extension if not exists "pgcrypto";

-- ========== 列舉 ==========
create type level_code as enum ('wanbao', 'wantong', 'wanle', 'wanchuang', 'wanjia'); -- 玩寶 玩童 玩樂 玩創 玩家
create type major_code as enum ('lego', '3d', 'art');
create type lead_type as enum ('trial', 'workshop', 'school', 'other');
create type class_kind as enum ('major', 'elective', 'workshop', 'camp', 'school');
create type attendance_status as enum ('present', 'late', 'absent', 'leave');
create type ledger_reason as enum ('purchase', 'bonus', 'reserve', 'consume', 'release', 'refund', 'expire', 'adjust');

-- ========== 官網表單：潛在客戶 ==========
create table leads (
  id uuid primary key default gen_random_uuid(),
  type lead_type not null,
  guardian_name text not null,
  phone text not null,
  email text,
  child_level level_code,
  interests major_code[] not null default '{}',
  message text,
  consent_at timestamptz not null,
  source text not null default 'website',
  status text not null default 'new', -- new / contacted / trial_booked / enrolled / closed
  created_at timestamptz not null default now()
);

-- ========== 人 ==========
create table guardians (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null, -- 家長登入帳號
  name text not null,
  phone text,
  email text,
  line_user_id text,
  created_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references guardians (id) on delete restrict,
  name text not null,                 -- 真實姓名：只有老師與家長看得到
  nickname text not null,             -- 角色暱稱：可公開在卡片、英雄榜
  birth_year int,
  level level_code not null,
  photo_consent boolean not null default false, -- 照片可否公開
  notes text,                         -- 接送、飲食等注意事項
  created_at timestamptz not null default now()
);

create table teachers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  is_admin boolean not null default false,
  active boolean not null default true
);

-- NFC／QR 卡片：卡片只存 UID，不存任何個資
create table cards (
  uid text primary key,
  student_id uuid references students (id) on delete set null,
  teacher_id uuid references teachers (id) on delete set null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (num_nonnulls(student_id, teacher_id) = 1)
);

-- ========== 課程與教案 ==========
create table courses (
  id uuid primary key default gen_random_uuid(),
  major major_code,                   -- 探索選修可為 null
  kind class_kind not null,
  title text not null,
  levels level_code[] not null,
  summary text,
  published boolean not null default false -- 官網是否顯示
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  seq int not null,
  title text not null,
  minutes int not null default 90,
  goals text,
  materials jsonb not null default '[]',  -- 教材與器材清單
  timeline jsonb not null default '[]',   -- [{min, teacher, students}]
  tips text,                              -- 常見卡關與解法
  version int not null default 1,
  updated_at timestamptz not null default now(),
  unique (course_id, seq)
);

create table lesson_files (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons (id) on delete cascade,
  kind text not null,                     -- model_io / image / pdf / code / video
  storage_path text not null,
  label text
);

-- ========== 開班、堂次、報名 ==========
create table classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id),
  teacher_id uuid references teachers (id),
  name text not null,                     -- 例：2027 春季 玩樂班 LEGO 週六 A
  room text,
  capacity int not null default 8,
  points_cost int,                        -- 探索選修每堂扣點；主修為 null
  starts_on date,
  ends_on date
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  lesson_id uuid references lessons (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references guardians (id),
  kind text not null,                     -- major_term / points_pack / workshop
  amount_twd int not null,
  status text not null default 'pending', -- pending / paid / refunded / cancelled
  provider text,                          -- ecpay ...
  provider_ref text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id),
  class_id uuid not null references classes (id),
  order_id uuid references orders (id),
  status text not null default 'active',  -- active / waitlist / cancelled / completed
  created_at timestamptz not null default now(),
  unique (student_id, class_id)
);

-- 核心事件：一筆出席 = 一個學生在一個堂次的紀錄
create table attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id),
  student_id uuid not null references students (id),
  status attendance_status not null,
  checked_in_at timestamptz,
  card_uid text references cards (uid),
  lesson_version int,                     -- 當天用的教案版本
  recorded_by uuid references teachers (id),
  unique (session_id, student_id)
);

create table teacher_attendance (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers (id),
  session_id uuid references sessions (id),
  check_in_at timestamptz not null,
  check_out_at timestamptz
);

-- 點數流水帳：餘額 = 加總，不直接存餘額
create table point_ledger (
  id bigint generated always as identity primary key,
  guardian_id uuid not null references guardians (id),
  delta int not null,
  reason ledger_reason not null,
  order_id uuid references orders (id),
  enrollment_id uuid references enrollments (id),
  attendance_id uuid references attendance (id),
  note text,
  expires_at timestamptz,
  created_by uuid references teachers (id),
  created_at timestamptz not null default now()
);

create view point_balances as
  select guardian_id, sum(delta)::int as balance from point_ledger group by guardian_id;

create table lesson_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id),
  teacher_id uuid not null references teachers (id),
  summary text,
  student_notes jsonb not null default '{}', -- {student_id: "觀察"}
  lesson_suggestions text,
  ai_draft boolean not null default false,
  created_at timestamptz not null default now()
);

-- ========== 角色養成 ==========
create table avatars (
  student_id uuid primary key references students (id) on delete cascade,
  base_style jsonb not null default '{}',    -- 膚色、髮型等外觀
  title text,                                -- 目前稱號
  updated_at timestamptz not null default now()
);

create table avatar_xp (
  student_id uuid not null references students (id) on delete cascade,
  track major_code not null,                 -- 機關工程師／造物工匠／色彩魔法師
  xp int not null default 0,
  primary key (student_id, track)
);

create table items (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                 -- 例 gear_gauntlet
  name text not null,
  slot text not null,                        -- helmet / hand / cape / boots / badge / skill
  track major_code,
  rarity text not null default 'common',
  image_path text,                           -- Storage 裡的分層圖片
  description text
);

-- 每堂教案指定解鎖的裝備
create table lesson_rewards (
  lesson_id uuid not null references lessons (id) on delete cascade,
  item_id uuid not null references items (id),
  xp int not null default 10,
  primary key (lesson_id, item_id)
);

create table student_items (
  student_id uuid not null references students (id) on delete cascade,
  item_id uuid not null references items (id),
  attendance_id uuid references attendance (id), -- 從哪一堂課得到
  equipped boolean not null default false,
  obtained_at timestamptz not null default now(),
  primary key (student_id, item_id)
);

create table works (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  session_id uuid references sessions (id),
  title text,
  storage_path text,
  public boolean not null default false,     -- 家長同意才公開
  created_at timestamptz not null default now()
);

-- 操作紀錄：人與 AI Agent 的每次寫入都留下痕跡
create table audit_log (
  id bigint generated always as identity primary key,
  actor text not null,                       -- teacher:<id> / agent:<name> / system
  action text not null,
  target text,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ========== 簽到觸發：出席 → 經驗值與裝備 ==========
create or replace function grant_rewards_on_attendance() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_lesson uuid;
  v_major major_code;
begin
  if new.status not in ('present', 'late') then return new; end if;
  select s.lesson_id, c.major into v_lesson, v_major
    from sessions s join classes cl on cl.id = s.class_id join courses c on c.id = cl.course_id
    where s.id = new.session_id;
  if v_lesson is null then return new; end if;

  insert into student_items (student_id, item_id, attendance_id)
    select new.student_id, r.item_id, new.id from lesson_rewards r where r.lesson_id = v_lesson
    on conflict do nothing;

  if v_major is not null then
    insert into avatar_xp (student_id, track, xp)
      select new.student_id, v_major, coalesce(sum(r.xp), 10) from lesson_rewards r where r.lesson_id = v_lesson
      on conflict (student_id, track) do update set xp = avatar_xp.xp + excluded.xp;
  end if;
  return new;
end $$;

create trigger trg_attendance_rewards
  after insert on attendance
  for each row execute function grant_rewards_on_attendance();

-- ========== 權限（RLS） ==========
-- 預設全部鎖起來；官網表單與後台透過伺服器端 service role 寫入。
-- 家長、老師的細部權限會在後台開發時逐表加上 policy。
alter table leads enable row level security;
alter table guardians enable row level security;
alter table students enable row level security;
alter table teachers enable row level security;
alter table cards enable row level security;
alter table courses enable row level security;
alter table lessons enable row level security;
alter table lesson_files enable row level security;
alter table classes enable row level security;
alter table sessions enable row level security;
alter table orders enable row level security;
alter table enrollments enable row level security;
alter table attendance enable row level security;
alter table teacher_attendance enable row level security;
alter table point_ledger enable row level security;
alter table lesson_reports enable row level security;
alter table avatars enable row level security;
alter table avatar_xp enable row level security;
alter table items enable row level security;
alter table lesson_rewards enable row level security;
alter table student_items enable row level security;
alter table works enable row level security;
alter table audit_log enable row level security;

-- 公開可讀：已發佈的課程、裝備圖鑑
create policy "public read published courses" on courses for select using (published);
create policy "public read items" on items for select using (true);

-- 家長只能看自己與自己孩子的資料
create policy "guardian reads self" on guardians for select using (auth_user_id = auth.uid());
create policy "guardian reads own students" on students for select
  using (guardian_id in (select id from guardians where auth_user_id = auth.uid()));
create policy "guardian reads own ledger" on point_ledger for select
  using (guardian_id in (select id from guardians where auth_user_id = auth.uid()));
create policy "guardian reads own avatars" on avatars for select
  using (student_id in (select s.id from students s join guardians g on g.id = s.guardian_id where g.auth_user_id = auth.uid()));
create policy "guardian reads own items" on student_items for select
  using (student_id in (select s.id from students s join guardians g on g.id = s.guardian_id where g.auth_user_id = auth.uid()));
create policy "guardian reads own xp" on avatar_xp for select
  using (student_id in (select s.id from students s join guardians g on g.id = s.guardian_id where g.auth_user_id = auth.uid()));

-- view 跟著底層表的權限
alter view point_balances set (security_invoker = true);

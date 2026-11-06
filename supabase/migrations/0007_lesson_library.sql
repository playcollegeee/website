-- 玩學院整合系統：第 4 階段「課程教案庫」第 1 批
-- 內容：
--   1. 教案從「某個班的課程」鬆開，改掛在「課程類別」底下，變成大家共用、可重複使用的教案庫
--   2. 課程類別（LEGO 幼兒大積木／動力／初階程式／進階程式、3D 初階／進階、美術依階段），管理員可在後台改
--   3. 共用標籤詞庫：主題、技能、結構、程式、技巧、知識
--   4. 教案新增欄位：適用階段、難易度、作者、狀態、三段流程、差異化、參考資料、經驗值、搜尋用文字
--   5. 出席獎勵改版：經驗值讀教案設定，不再每堂發裝備（裝備改為期末發放，由角色養成系統處理）
--   6. 搜尋教案、合併標籤的資料庫函式（只有伺服器能呼叫）
-- 在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。不會刪除既有資料。

begin;

-- 中文關鍵字搜尋用（三字元索引；Supabase 內建可直接開）
create extension if not exists pg_trgm;

-- ========== 1. 課程類別 ==========
create table lesson_categories (
  id uuid primary key default gen_random_uuid(),
  major major_code not null,                       -- 屬於哪個主修
  name text not null check (length(trim(name)) > 0),
  levels level_code[] not null default '{}',       -- 建議適用階段（新增教案時當預設值）
  description text,
  sort int not null default 0,                     -- 同一主修內的排序
  active boolean not null default true,            -- 停用後不能再選，但舊教案保留
  created_at timestamptz not null default now(),
  unique (major, name)
);

insert into lesson_categories (major, name, levels, sort) values
  ('lego', '幼兒大積木', '{wanbao}', 10),
  ('lego', '動力',       '{wantong,wanle}', 20),
  ('lego', '初階程式',   '{wanle}', 30),
  ('lego', '進階程式',   '{wanchuang,wanjia}', 40),
  ('3d',   '3D 初階',    '{wanle}', 10),
  ('3d',   '3D 進階',    '{wanchuang,wanjia}', 20),
  ('art',  '美術・玩寶', '{wanbao}', 10),
  ('art',  '美術・玩童', '{wantong}', 20),
  ('art',  '美術・玩樂', '{wanle}', 30),
  ('art',  '美術・玩創', '{wanchuang}', 40),
  ('art',  '美術・玩家', '{wanjia}', 50);

-- ========== 2. 標籤詞庫 ==========
-- kind：theme 主題／skill 技能／structure 結構／code 程式／technique 技巧／knowledge 知識
create table tags (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('theme', 'skill', 'structure', 'code', 'technique', 'knowledge')),
  name text not null check (length(trim(name)) > 0 and length(name) <= 30),
  created_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, name)
);

insert into tags (kind, name) values
  ('theme', '交通工具'), ('theme', '動物'), ('theme', '太空'), ('theme', '城市'),
  ('theme', '海洋'), ('theme', '遊樂園'), ('theme', '節慶'),
  ('skill', '依圖拼裝'), ('skill', '除錯'), ('skill', '團隊合作'), ('skill', '口語發表'), ('skill', '設計思考'),
  ('structure', '齒輪傳動'), ('structure', '槓桿'), ('structure', '滑輪'), ('structure', '連桿'),
  ('structure', '輪軸'), ('structure', '三角支撐'),
  ('code', '循序'), ('code', '迴圈'), ('code', '條件判斷'), ('code', '變數'), ('code', '感測器'), ('code', '馬達控制'),
  ('technique', '布林運算'), ('technique', '列印支撐'), ('technique', '切片設定'), ('technique', '疊色'), ('technique', '構圖'),
  ('knowledge', '摩擦力'), ('knowledge', '力矩'), ('knowledge', '重心'), ('knowledge', '色彩三原色');

create table lesson_tags (
  lesson_id uuid not null references lessons (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (lesson_id, tag_id)
);
create index on lesson_tags (tag_id);

-- ========== 3. 教案：鬆開課程、加上教案庫欄位 ==========
-- 原本每個教案一定屬於某個課程（courses）並有堂次編號；改成選填。
-- 舊的「開班時依序掛教案」（generate_sessions）照樣可用。
alter table lessons alter column course_id drop not null;
alter table lessons alter column seq drop not null;

alter table lessons
  add column category_id uuid references lesson_categories (id) on delete restrict,
  add column levels level_code[] not null default '{}',          -- 適用階段（可多選）
  add column difficulty smallint check (difficulty between 1 and 5),
  add column status text not null default 'draft'
    check (status in ('draft', 'ready', 'archived')),           -- 草稿／可使用／封存
  add column author_id uuid references teachers (id) on delete set null,
  add column updated_by uuid references teachers (id) on delete set null,
  add column summary text,                                        -- 一句話簡介
  add column refs text,                                           -- 前導引導用的參考資料、影片、連結
  add column challenge text,                                      -- 差異化：做得快的孩子的挑戰題
  add column support text,                                        -- 差異化：需要協助時的簡化版
  add column xp int not null default 10 check (xp between 0 and 100), -- 出席給的經驗值
  add column created_at timestamptz not null default now();

-- timeline 改成三段流程：[{phase: intro|main|wrap, min, title, teacher, students}]
-- materials：[{name, qty}]
comment on column lessons.timeline is '教學流程 [{phase: intro 前導引導|main 主要活動|wrap 分享收尾, min, title, teacher, students}]';
comment on column lessons.materials is '器材與材料 [{name, qty}]';
comment on column lessons.tips is '常見卡關與解法';

-- 搜尋用文字：標題、簡介、目標、流程、器材、卡關…全部串起來（轉小寫），自動更新
alter table lessons add column search_text text generated always as (
  lower(
    coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(goals, '') || ' ' ||
    coalesce(refs, '') || ' ' || coalesce(tips, '') || ' ' || coalesce(challenge, '') || ' ' ||
    coalesce(support, '') || ' ' || timeline::text || ' ' || materials::text
  )
) stored;

create index lessons_search_trgm on lessons using gin (search_text gin_trgm_ops);
create index on lessons (category_id);
create index on lessons (status, updated_at desc);
create index on lessons (author_id);
create index on sessions (lesson_id);

-- ========== 4. 出席獎勵改版 ==========
-- 經驗值讀教案上的 xp（沒有指定教案時給主修 10 點）；不再每堂發裝備。
-- lesson_rewards 表先保留不刪，角色養成系統改成期末發裝備時再整理。
create or replace function grant_rewards_on_attendance() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_major major_code;
  v_xp int;
begin
  if new.status not in ('present', 'late') then return new; end if;
  -- 更新時：原本就已經是出席／遲到，就不重複發
  if tg_op = 'UPDATE' and old.status in ('present', 'late') then return new; end if;

  select c.major, l.xp into v_major, v_xp
    from sessions s
    join classes cl on cl.id = s.class_id
    join courses c on c.id = cl.course_id
    left join lessons l on l.id = s.lesson_id
    where s.id = new.session_id;

  if v_major is not null then
    insert into avatar_xp (student_id, track, xp) values (new.student_id, v_major, coalesce(v_xp, 10))
      on conflict (student_id, track) do update set xp = avatar_xp.xp + excluded.xp;
  end if;
  return new;
end $$;

-- ========== 5. 搜尋教案 ==========
-- 關鍵字可用空白分開多個詞（每個詞都要找得到）；會同時找教案內容與標籤名稱。
-- p_tags：必須同時有這些標籤；p_status 為 null 時列出「草稿＋可使用」，'all' 列出全部。
create or replace function search_lessons(
  p_q text default null,
  p_major major_code default null,
  p_category uuid default null,
  p_level level_code default null,
  p_tags uuid[] default null,
  p_difficulty int default null,
  p_author uuid default null,
  p_status text default null,
  p_limit int default 200)
returns table (id uuid)
language sql stable security definer set search_path = public as $$
  select l.id
  from lessons l
  left join lesson_categories c on c.id = l.category_id
  where
    not exists (
      select 1 from regexp_split_to_table(trim(coalesce(p_q, '')), '\s+') w
      where w <> ''
        and position(lower(w) in l.search_text) = 0
        and not exists (
          select 1 from lesson_tags lt join tags t on t.id = lt.tag_id
          where lt.lesson_id = l.id and position(lower(w) in lower(t.name)) > 0)
    )
    and (p_major is null or c.major = p_major)
    and (p_category is null or l.category_id = p_category)
    and (p_level is null or p_level = any (l.levels))
    and (p_tags is null or cardinality(p_tags) = 0 or not exists (
      select unnest(p_tags) except select lt.tag_id from lesson_tags lt where lt.lesson_id = l.id))
    and (p_difficulty is null or l.difficulty = p_difficulty)
    and (p_author is null or l.author_id = p_author)
    and (case
           when p_status is null then l.status <> 'archived'
           when p_status = 'all' then true
           else l.status = p_status
         end)
  order by l.updated_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500)
$$;
revoke all on function search_lessons(text, major_code, uuid, level_code, uuid[], int, uuid, text, int)
  from public, anon, authenticated;

-- ========== 6. 合併標籤（同義詞） ==========
-- 把 p_from 的教案全部改掛到 p_into，再刪掉 p_from。兩個標籤必須同一類。
create or replace function merge_tags(p_from uuid, p_into uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if p_from = p_into then raise exception '不能合併到自己'; end if;
  if (select kind from tags where id = p_from) is distinct from (select kind from tags where id = p_into) then
    raise exception '只能合併同一類的標籤';
  end if;
  insert into lesson_tags (lesson_id, tag_id)
    select lesson_id, p_into from lesson_tags where tag_id = p_from
    on conflict do nothing;
  get diagnostics v_n = row_count;
  delete from tags where id = p_from;
  return v_n;
end $$;
revoke all on function merge_tags(uuid, uuid) from public, anon, authenticated;

-- ========== 7. 權限（RLS） ==========
-- 新表一律開 RLS、不開放前端直接讀寫；後台透過伺服器（service role）存取並檢查老師身分。
alter table lesson_categories enable row level security;
alter table tags enable row level security;
alter table lesson_tags enable row level security;

commit;

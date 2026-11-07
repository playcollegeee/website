-- 玩學院整合系統：器材盒組清單、課程遇到的問題（含老師互相回饋的備註）
-- 1. material_presets：教案表單「器材與材料」可以直接點選的盒組與常用材料（管理員在「課程分類與標籤」頁管理）
-- 2. lesson_notes 新增 kind：issue 課程遇到的問題、reply 問題底下的備註（parent_id 指向問題）
--    舊的「常見卡關與解法」（lessons.tips）每一行搬成一筆「舊資料」問題；lessons.tips 欄位保留不刪
-- 在 Supabase → SQL Editor 貼上整份執行（只需執行一次，重複執行也不會重複新增）。

begin;

-- ---------- 1. 器材盒組清單 ----------
create table if not exists material_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 1 and 80),
  kind text not null default 'kit' check (kind in ('kit', 'material')),   -- kit 盒組／material 其他材料
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table material_presets enable row level security;

insert into material_presets (name, kind, sort) values
  ('幼兒積木教具盒(9656)', 'kit', 10),
  ('BricQ教具盒組(45400)', 'kit', 20),
  ('BricQ外派盒', 'kit', 30),
  ('SPIKE™ Prime(45678)', 'kit', 40)
on conflict (name) do nothing;

-- ---------- 2. 課程遇到的問題、備註 ----------
alter table lesson_notes drop constraint if exists lesson_notes_kind_check;
alter table lesson_notes add constraint lesson_notes_kind_check check (kind in ('ref', 'activity', 'issue', 'reply'));
alter table lesson_notes add column if not exists parent_id uuid references lesson_notes (id) on delete cascade;
alter table lesson_notes drop constraint if exists lesson_notes_reply_parent;
alter table lesson_notes add constraint lesson_notes_reply_parent check ((kind = 'reply') = (parent_id is not null));
create index if not exists lesson_notes_parent on lesson_notes (parent_id) where parent_id is not null;

-- 舊的「常見卡關與解法」一行一筆搬過來（去掉開頭的 -、•、1. 之類符號）
insert into lesson_notes (lesson_id, kind, body, author_id, created_at, updated_at)
select l.id, 'issue', left(t.line, 3000), null, coalesce(l.created_at, now()), coalesce(l.created_at, now())
from lessons l
cross join lateral (
  select trim(regexp_replace(x, '^\s*([-•・*]|\d+[.、)）])\s*', '')) as line, ord
  from unnest(string_to_array(coalesce(l.tips, ''), E'\n')) with ordinality as u(x, ord)
) t
where t.line <> ''
  and not exists (select 1 from lesson_notes n where n.lesson_id = l.id and n.kind = 'issue' and n.author_id is null)
order by l.id, t.ord;

commit;

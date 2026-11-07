-- 玩學院整合系統：教案的「參考資料」與「參考進行活動」
-- 每位老師都可以在教案下新增；只能編輯自己寫的；舊資料與其他老師寫的只有管理員能編輯或刪除。
--   kind：ref 參考資料（繪本、影片、網址、書籍）／activity 參考進行活動（自己帶這堂課的做法、引導方式、變化玩法）
-- 在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。不會刪除既有資料。

begin;

create table if not exists lesson_notes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons (id) on delete cascade,
  kind text not null check (kind in ('ref', 'activity')),
  body text not null check (length(body) between 1 and 3000),
  url text check (url is null or url ~ '^https?://'),
  author_id uuid references teachers (id) on delete set null,   -- null＝舊資料（只有管理員能改）
  updated_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lesson_notes_lesson on lesson_notes (lesson_id, kind, created_at);

-- 只讓後台伺服器（service role）讀寫
alter table lesson_notes enable row level security;

-- 既有教案裡的參考資料搬一份過來當「舊資料」（沒有作者，只有管理員能改）。
-- lessons.refs 本身保留，合作單位教案仍可使用。重複執行不會重複搬。
insert into lesson_notes (lesson_id, kind, body, author_id, created_at, updated_at)
select l.id, 'ref', left(trim(l.refs), 3000), null, coalesce(l.created_at, now()), coalesce(l.created_at, now())
from lessons l
where nullif(trim(coalesce(l.refs, '')), '') is not null
  and not exists (select 1 from lesson_notes n where n.lesson_id = l.id and n.kind = 'ref' and n.author_id is null);

commit;

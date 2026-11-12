-- 玩學院整合系統：會議室（規劃頁與會議室整合）
--   meetings.seq             這份規劃的第幾次會議（新增會議時自動編號「第 X 次會議」）
--   plan_tasks.meeting_id    這個待辦是在哪一場會議產生的（分出「上次待辦」與「這次的待辦」）
--   plan_comments.meeting_id 這則留言／決議是在哪一場會議產生的（決議列表標出「這次」）
-- 需要先執行 0013、0017。在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。

begin;

alter table meetings add column if not exists seq int check (seq is null or seq between 1 and 999);
alter table plan_tasks add column if not exists meeting_id uuid references meetings (id) on delete set null;
alter table plan_comments add column if not exists meeting_id uuid references meetings (id) on delete set null;
create index if not exists plan_tasks_meeting on plan_tasks (meeting_id);
create index if not exists plan_comments_meeting on plan_comments (meeting_id);

-- 既有的會議依建立時間補上編號
update meetings m set seq = n.rn
from (
  select id, row_number() over (partition by plan_id order by created_at) as rn
  from meetings where plan_id is not null
) n
where m.id = n.id and m.seq is null;

commit;

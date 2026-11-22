-- 玩學院整合系統：規劃與議程的負責老師可以複選（2026-11-19 之後，延續 0024）
--   plans.owner_ids（規劃負責老師，含冬夏令營）、meeting_agenda.owner_ids（負責說明的老師）
--   舊欄位 owner_id 保留，觸發器自動維持「第一位老師」，舊程式照常能用
-- 需要先執行 0012～0024。在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。不會刪除既有資料。

begin;

alter table plans add column if not exists owner_ids uuid[] not null default '{}';
alter table meeting_agenda add column if not exists owner_ids uuid[] not null default '{}';

update plans set owner_ids = array[owner_id] where owner_id is not null and owner_ids = '{}';
update meeting_agenda set owner_ids = array[owner_id] where owner_id is not null and owner_ids = '{}';

create index if not exists plans_owner_ids_idx on plans using gin (owner_ids);

-- 兩個欄位互相同步（和 0024 的 plan_items、plan_tasks 同一套規則）
create or replace function sync_owner_ids() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(cardinality(new.owner_ids), 0) > 0 then new.owner_id := new.owner_ids[1];
    elsif new.owner_id is not null then new.owner_ids := array[new.owner_id];
    else new.owner_ids := '{}'; end if;
  elsif new.owner_ids is distinct from old.owner_ids then
    new.owner_ids := coalesce(new.owner_ids, '{}');
    new.owner_id := new.owner_ids[1];
  elsif new.owner_id is distinct from old.owner_id then
    new.owner_ids := case when new.owner_id is null then '{}'::uuid[] else array[new.owner_id] end;
  end if;
  return new;
end $$;

drop trigger if exists plans_sync_owners on plans;
create trigger plans_sync_owners before insert or update on plans
  for each row execute function sync_owner_ids();
drop trigger if exists meeting_agenda_sync_owners on meeting_agenda;
create trigger meeting_agenda_sync_owners before insert or update on meeting_agenda
  for each row execute function sync_owner_ids();

commit;

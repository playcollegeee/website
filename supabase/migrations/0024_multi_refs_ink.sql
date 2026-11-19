-- 玩學院整合系統：規劃與會議室改版（2026-11-19）
--   1. 時程安排、待辦的負責老師可以複選：plan_items.teacher_ids、plan_tasks.assignee_ids
--      舊欄位 teacher_id／assignee_id 保留，觸發器自動維持「第一位老師」，舊程式照常能用
--   2. 參考網址及檔案：plan_refs（可記在某場會議），檔案放私人 bucket「plan-files」（單檔 20 MB）
--   3. 白板塗鴉：board_items.kind 多 ink（手繪線條），points 存筆畫；顏色多 black
--      board_sync() 改版：可以新增塗鴉，塗鴉可以拖動、換色、刪除，不能改字、不能當箭頭端點
-- 需要先執行 0012～0020。在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。不會刪除既有資料。

begin;

-- ---------- 1. 負責老師複選 ----------
alter table plan_items add column if not exists teacher_ids uuid[] not null default '{}';
alter table plan_tasks add column if not exists assignee_ids uuid[] not null default '{}';

update plan_items set teacher_ids = array[teacher_id] where teacher_id is not null and teacher_ids = '{}';
update plan_tasks set assignee_ids = array[assignee_id] where assignee_id is not null and assignee_ids = '{}';

create index if not exists plan_tasks_assignee_ids_idx on plan_tasks using gin (assignee_ids);
create index if not exists plan_items_teacher_ids_idx on plan_items using gin (teacher_ids);

-- 兩個欄位互相同步：改了陣列就把第一位寫回舊欄位；只改舊欄位（舊程式、AI 套用）就把陣列改成那一位
create or replace function plan_items_sync_teachers() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(cardinality(new.teacher_ids), 0) > 0 then new.teacher_id := new.teacher_ids[1];
    elsif new.teacher_id is not null then new.teacher_ids := array[new.teacher_id];
    else new.teacher_ids := '{}'; end if;
  elsif new.teacher_ids is distinct from old.teacher_ids then
    new.teacher_ids := coalesce(new.teacher_ids, '{}');
    new.teacher_id := new.teacher_ids[1];
  elsif new.teacher_id is distinct from old.teacher_id then
    new.teacher_ids := case when new.teacher_id is null then '{}'::uuid[] else array[new.teacher_id] end;
  end if;
  return new;
end $$;
drop trigger if exists plan_items_sync_teachers on plan_items;
create trigger plan_items_sync_teachers before insert or update on plan_items
  for each row execute function plan_items_sync_teachers();

create or replace function plan_tasks_sync_assignees() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(cardinality(new.assignee_ids), 0) > 0 then new.assignee_id := new.assignee_ids[1];
    elsif new.assignee_id is not null then new.assignee_ids := array[new.assignee_id];
    else new.assignee_ids := '{}'; end if;
  elsif new.assignee_ids is distinct from old.assignee_ids then
    new.assignee_ids := coalesce(new.assignee_ids, '{}');
    new.assignee_id := new.assignee_ids[1];
  elsif new.assignee_id is distinct from old.assignee_id then
    new.assignee_ids := case when new.assignee_id is null then '{}'::uuid[] else array[new.assignee_id] end;
  end if;
  return new;
end $$;
drop trigger if exists plan_tasks_sync_assignees on plan_tasks;
create trigger plan_tasks_sync_assignees before insert or update on plan_tasks
  for each row execute function plan_tasks_sync_assignees();

-- ---------- 2. 參考網址及檔案 ----------
create table if not exists plan_refs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans (id) on delete cascade,
  meeting_id uuid references meetings (id) on delete set null, -- 在哪場會議貼的（會議刪掉後資料留在規劃）
  kind text not null check (kind in ('link', 'file')),
  title text not null default '' check (length(title) <= 120),
  url text check (url is null or (length(url) <= 2000 and url ~* '^https?://')),
  file_path text, -- plan-files bucket 裡的路徑
  file_name text check (file_name is null or length(file_name) <= 200),
  file_size int,
  mime text,
  created_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'link' and url is not null) or (kind = 'file' and file_path is not null))
);
create index if not exists plan_refs_plan_idx on plan_refs (plan_id, created_at);
create index if not exists plan_refs_meeting_idx on plan_refs (meeting_id);
alter table plan_refs enable row level security; -- 只有後台伺服器（service role）能讀寫

-- 私人 bucket：只有後台伺服器能讀寫；老師下載時由伺服器產生限時連結。單檔最大 20 MB
insert into storage.buckets (id, name, public, file_size_limit)
values ('plan-files', 'plan-files', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- ---------- 3. 白板塗鴉 ----------
alter table board_items drop constraint if exists board_items_kind_check;
alter table board_items add constraint board_items_kind_check check (kind in ('note', 'section', 'arrow', 'ink'));
alter table board_items drop constraint if exists board_items_color_check;
alter table board_items add constraint board_items_color_check
  check (color in ('yellow', 'green', 'red', 'blue', 'white', 'black'));
-- 塗鴉的筆畫：{"w": 粗細, "p": [[x,y], ...]}，座標相對於 x、y
alter table board_items add column if not exists points jsonb;

create or replace function board_sync(
  p_meeting uuid, p_teacher uuid, p_mod boolean, p_ops jsonb, p_since bigint, p_editing uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  op jsonb;
  cur board_items;
  rejected int := 0;
  n int;
  v_id uuid;
  v_text text;
  v_from uuid;
  v_to uuid;
  v_pts jsonb;
begin
  if jsonb_typeof(coalesce(p_ops, '[]'::jsonb)) <> 'array' then
    raise exception '資料格式不正確';
  end if;

  for op in select * from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb)) loop
    begin
      v_id := (op->>'id')::uuid;
      select * into cur from board_items where id = v_id and meeting_id = p_meeting;

      if op->>'op' = 'add' then
        if found then continue; end if;            -- 重送的新增：已經有了就略過
        select count(*) into n from board_items where meeting_id = p_meeting and deleted_at is null;
        if n >= 500 then rejected := rejected + 1; continue; end if;
        if op->>'kind' = 'arrow' then
          -- 箭頭：兩端都要是這塊白板上還在的便利貼或分區框，而且不能連到自己
          v_from := (op->>'from_id')::uuid;
          v_to := (op->>'to_id')::uuid;
          if v_from is null or v_to is null or v_from = v_to
             or (select count(*) from board_items where id in (v_from, v_to) and meeting_id = p_meeting
                   and deleted_at is null and kind in ('note', 'section')) <> 2 then
            rejected := rejected + 1; continue;
          end if;
          insert into board_items (id, meeting_id, kind, x, y, w, h, z, color, text, from_id, to_id, author_id, updated_by)
          values (v_id, p_meeting, 'arrow', 0, 0, 80, 60, 0, 'white', '', v_from, v_to, p_teacher, p_teacher);
          continue;
        end if;
        if op->>'kind' = 'ink' then
          -- 塗鴉：一筆最多 1500 個點、資料不超過 40 KB
          v_pts := op->'points';
          if v_pts is null or jsonb_typeof(v_pts) <> 'object' or jsonb_typeof(v_pts->'p') <> 'array'
             or jsonb_array_length(v_pts->'p') < 1 or jsonb_array_length(v_pts->'p') > 1500
             or length(v_pts::text) > 40000 then
            rejected := rejected + 1; continue;
          end if;
          insert into board_items (id, meeting_id, kind, x, y, w, h, z, color, text, points, author_id, updated_by)
          values (
            v_id, p_meeting, 'ink',
            greatest(-20000, least(20000, coalesce((op->>'x')::int, 0))),
            greatest(-20000, least(20000, coalesce((op->>'y')::int, 0))),
            greatest(80, least(3000, coalesce((op->>'w')::int, 80))),
            greatest(60, least(3000, coalesce((op->>'h')::int, 60))),
            coalesce((op->>'z')::int, 0),
            case when op->>'color' in ('yellow', 'green', 'red', 'blue', 'white', 'black') then op->>'color' else 'black' end,
            '',
            jsonb_build_object('w', greatest(1, least(24, coalesce((v_pts->>'w')::int, 3))), 'p', v_pts->'p'),
            p_teacher, p_teacher
          );
          continue;
        end if;
        v_text := left(coalesce(op->>'text', ''), case when op->>'kind' = 'section' then 60 else 300 end);
        insert into board_items (id, meeting_id, kind, x, y, w, h, z, color, text, author_id, updated_by)
        values (
          v_id, p_meeting,
          case when op->>'kind' = 'section' then 'section' else 'note' end,
          greatest(-20000, least(20000, coalesce((op->>'x')::int, 0))),
          greatest(-20000, least(20000, coalesce((op->>'y')::int, 0))),
          greatest(80, least(3000, coalesce((op->>'w')::int, 180))),
          greatest(60, least(3000, coalesce((op->>'h')::int, 120))),
          coalesce((op->>'z')::int, 0),
          case when op->>'color' in ('yellow', 'green', 'red', 'blue', 'white') then op->>'color' else 'yellow' end,
          v_text, p_teacher, p_teacher
        );

      elsif not found or cur.deleted_at is not null then
        rejected := rejected + 1;

      elsif cur.kind = 'arrow' and op->>'op' in ('move', 'edit') then
        rejected := rejected + 1;

      elsif op->>'op' = 'move' then
        -- 塗鴉只能拖動位置，不能調大小
        update board_items set
          x = greatest(-20000, least(20000, coalesce((op->>'x')::int, x))),
          y = greatest(-20000, least(20000, coalesce((op->>'y')::int, y))),
          w = case when kind <> 'ink' and (kind = 'section' or p_mod or author_id = p_teacher)
                then greatest(80, least(3000, coalesce((op->>'w')::int, w))) else w end,
          h = case when kind <> 'ink' and (kind = 'section' or p_mod or author_id = p_teacher)
                then greatest(60, least(3000, coalesce((op->>'h')::int, h))) else h end,
          z = coalesce((op->>'z')::int, z),
          updated_by = p_teacher
        where id = v_id;

      elsif op->>'op' = 'edit' then
        if not (p_mod or cur.author_id = p_teacher) then rejected := rejected + 1; continue; end if;
        update board_items set
          text = case when op ? 'text' and kind <> 'ink'
                   then left(coalesce(op->>'text', ''), case when kind = 'section' then 60 else 300 end) else text end,
          color = case
                    when kind = 'ink' and op->>'color' in ('yellow', 'green', 'red', 'blue', 'white', 'black') then op->>'color'
                    when kind <> 'ink' and op->>'color' in ('yellow', 'green', 'red', 'blue', 'white') then op->>'color'
                    else color end,
          updated_by = p_teacher
        where id = v_id;

      elsif op->>'op' = 'del' then
        if not (p_mod or cur.author_id = p_teacher) then rejected := rejected + 1; continue; end if;
        update board_items set deleted_at = now(), updated_by = p_teacher where id = v_id;
        -- 刪掉便利貼或分區框時，連著它的箭頭也一起刪
        update board_items set deleted_at = now(), updated_by = p_teacher
        where meeting_id = p_meeting and kind = 'arrow' and deleted_at is null and (from_id = v_id or to_id = v_id);

      else
        rejected := rejected + 1;
      end if;
    exception when others then
      rejected := rejected + 1;                    -- 單一筆有問題不影響其他筆
    end;
  end loop;

  insert into board_presence (meeting_id, teacher_id, editing, seen_at)
  values (p_meeting, p_teacher, p_editing, now())
  on conflict (meeting_id, teacher_id) do update set editing = excluded.editing, seen_at = now();

  return jsonb_build_object(
    'rev', coalesce((select max(rev) from board_items where meeting_id = p_meeting), 0),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'x', b.x, 'y', b.y, 'w', b.w, 'h', b.h, 'z', b.z, 'color', b.color, 'text', b.text,
        'author_id', b.author_id, 'updated_by', b.updated_by, 'rev', b.rev, 'deleted', b.deleted_at is not null,
        'from_id', b.from_id, 'to_id', b.to_id, 'points', b.points
      ) order by b.rev)
      from board_items b
      where b.meeting_id = p_meeting and b.rev > coalesce(p_since, 0)
        and (coalesce(p_since, 0) > 0 or b.deleted_at is null)
    ), '[]'::jsonb),
    'presence', coalesce((
      select jsonb_agg(jsonb_build_object('teacher_id', p.teacher_id, 'editing', p.editing))
      from board_presence p
      where p.meeting_id = p_meeting and p.seen_at > now() - interval '30 seconds'
    ), '[]'::jsonb),
    'rejected', rejected
  );
end $$;

revoke all on function board_sync(uuid, uuid, boolean, jsonb, bigint, uuid) from public, anon, authenticated;

commit;

-- 玩學院整合系統：會議討論白板第 2 批：箭頭連線
--   board_items.kind 多一種 arrow（箭頭），from_id／to_id 是兩端的便利貼或分區框
--   board_sync() 改版：可以新增箭頭；刪掉便利貼或分區框時，連著的箭頭一起刪
-- 需要先執行 0018。在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。

begin;

alter table board_items drop constraint if exists board_items_kind_check;
alter table board_items add constraint board_items_kind_check check (kind in ('note', 'section', 'arrow'));
alter table board_items add column if not exists from_id uuid references board_items (id) on delete cascade;
alter table board_items add column if not exists to_id uuid references board_items (id) on delete cascade;

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
                   and deleted_at is null and kind <> 'arrow') <> 2 then
            rejected := rejected + 1; continue;
          end if;
          insert into board_items (id, meeting_id, kind, x, y, w, h, z, color, text, from_id, to_id, author_id, updated_by)
          values (v_id, p_meeting, 'arrow', 0, 0, 80, 60, 0, 'white', '', v_from, v_to, p_teacher, p_teacher);
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
        update board_items set
          x = greatest(-20000, least(20000, coalesce((op->>'x')::int, x))),
          y = greatest(-20000, least(20000, coalesce((op->>'y')::int, y))),
          w = case when kind = 'section' or p_mod or author_id = p_teacher
                then greatest(80, least(3000, coalesce((op->>'w')::int, w))) else w end,
          h = case when kind = 'section' or p_mod or author_id = p_teacher
                then greatest(60, least(3000, coalesce((op->>'h')::int, h))) else h end,
          z = coalesce((op->>'z')::int, z),
          updated_by = p_teacher
        where id = v_id;

      elsif op->>'op' = 'edit' then
        if not (p_mod or cur.author_id = p_teacher) then rejected := rejected + 1; continue; end if;
        update board_items set
          text = case when op ? 'text'
                   then left(coalesce(op->>'text', ''), case when kind = 'section' then 60 else 300 end) else text end,
          color = case when op->>'color' in ('yellow', 'green', 'red', 'blue', 'white') then op->>'color' else color end,
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
        'from_id', b.from_id, 'to_id', b.to_id
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

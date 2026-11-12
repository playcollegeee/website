-- 玩學院整合系統：會議討論白板（一場會議一塊白板）
--   board_items     白板上的便利貼（note）與分區框（section）
--   board_presence  誰正開著白板、正在編輯哪一張（30 秒沒回應視為離開）
--   meeting_helpers 這場會議的小幫手老師：和會議建立者一樣，可以改、刪任何便利貼與分區框
--   board_sync()    一次完成：寫入變更 → 更新在線狀態 → 回傳某個版本之後的所有變動
-- 需要先執行 0013（會議紀錄）。在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。

begin;

-- 每次新增或修改都拿一個新的版本序號，瀏覽器只抓「比我手上新」的部分
create sequence if not exists board_rev_seq;

create table if not exists board_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  kind text not null default 'note' check (kind in ('note', 'section')),
  x int not null default 0 check (x between -20000 and 20000),
  y int not null default 0 check (y between -20000 and 20000),
  w int not null default 180 check (w between 80 and 3000),
  h int not null default 120 check (h between 60 and 3000),
  z int not null default 0,
  color text not null default 'yellow' check (color in ('yellow', 'green', 'red', 'blue', 'white')),
  text text not null default '' check (length(text) <= 300),
  author_id uuid references teachers (id) on delete set null,
  updated_by uuid references teachers (id) on delete set null,
  rev bigint not null default nextval('board_rev_seq'),
  deleted_at timestamptz,             -- 刪除先做標記，其他老師的畫面才會跟著消失
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists board_items_meeting_rev on board_items (meeting_id, rev);

create or replace function board_items_touch() returns trigger language plpgsql as $$
begin
  new.rev := nextval('board_rev_seq');
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists board_items_touch on board_items;
create trigger board_items_touch before update on board_items for each row execute function board_items_touch();

create table if not exists board_presence (
  meeting_id uuid not null references meetings (id) on delete cascade,
  teacher_id uuid not null references teachers (id) on delete cascade,
  editing uuid,                       -- 正在編輯的便利貼
  seen_at timestamptz not null default now(),
  primary key (meeting_id, teacher_id)
);

create table if not exists meeting_helpers (
  meeting_id uuid not null references meetings (id) on delete cascade,
  teacher_id uuid not null references teachers (id) on delete cascade,
  added_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (meeting_id, teacher_id)
);

-- 只讓後台伺服器（service role）讀寫
alter table board_items enable row level security;
alter table board_presence enable row level security;
alter table meeting_helpers enable row level security;

-- 白板同步：p_mod = 這位老師是否可以管理整塊白板（會議建立者、小幫手、管理員；由伺服器判斷後傳入）
-- p_ops：[{op:add,id,kind,x,y,w,h,z,color,text} | {op:move,id,x,y,w,h,z} | {op:edit,id,text?,color?} | {op:del,id}]
-- 權限：所有老師可以新增、拖動；改字與換色限便利貼作者（分區框限建立者）或管理者；刪除同上
-- 回傳 {rev, items, presence, rejected}
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
        'author_id', b.author_id, 'updated_by', b.updated_by, 'rev', b.rev, 'deleted', b.deleted_at is not null
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

-- 只有伺服器（service role）可以呼叫
revoke all on function board_sync(uuid, uuid, boolean, jsonb, bigint, uuid) from public, anon, authenticated;

commit;

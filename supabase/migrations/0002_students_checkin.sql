-- 玩學院整合系統：第 2 階段「學生資料庫＋簽到」
-- 內容：一位學生可綁多位家長、個資同意紀錄、老師帳號、NFC 讀卡站、刷卡紀錄、簽到函式。
-- 在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。不會刪除既有資料。

begin;

-- ========== 1. 家長與學生：改成多對多 ==========
-- 一位學生可以有爸爸、媽媽、阿嬤等多位聯絡人；一位家長也可以有多個孩子。
create table student_guardians (
  student_id uuid not null references students (id) on delete cascade,
  guardian_id uuid not null references guardians (id) on delete cascade,
  relation text,                               -- 媽媽／爸爸／阿嬤…
  is_primary boolean not null default false,   -- 主要聯絡人（點數、帳單、通知都找他）
  can_pickup boolean not null default true,    -- 可以接送
  primary key (student_id, guardian_id)
);
create index on student_guardians (guardian_id);

-- 舊欄位的資料先搬過來，再移除舊欄位（依賴它的權限規則先拿掉、稍後重建）
insert into student_guardians (student_id, guardian_id, is_primary)
  select id, guardian_id, true from students where guardian_id is not null
  on conflict do nothing;

drop policy if exists "guardian reads own students" on students;
drop policy if exists "guardian reads own avatars" on avatars;
drop policy if exists "guardian reads own items" on student_items;
drop policy if exists "guardian reads own xp" on avatar_xp;
alter table students drop column guardian_id;

alter table guardians
  add column note text,
  add column updated_at timestamptz not null default now();

-- 學生：個資同意紀錄與在學狀態
alter table students
  add column gender text,                                   -- 選填
  add column school text,                                   -- 選填
  add column active boolean not null default true,          -- 休學／離開設為 false，資料保留
  add column consent_at timestamptz,                        -- 家長同意個資蒐集的時間
  add column consent_by uuid references guardians (id) on delete set null,
  add column consent_method text,                           -- paper／online
  add column consent_version text,                          -- 同意書版本，例 2026-11
  add column photo_consent_at timestamptz,
  add column updated_at timestamptz not null default now();

-- 角色暱稱是公開顯示用，不可以是空白
alter table students add constraint nickname_not_blank check (length(trim(nickname)) > 0);

-- ========== 2. 老師帳號 ==========
alter table teachers
  add column email text unique,           -- 登入用 Email（對應 Supabase Auth）
  add column phone text,
  add column nickname text,               -- 讀卡站上顯示的稱呼，例「阿智老師」
  add column created_at timestamptz not null default now();

-- ========== 3. 卡片：區分 NFC／QR，可加標籤 ==========
alter table cards
  add column kind text not null default 'nfc' check (kind in ('nfc', 'qr')),
  add column label text;                  -- 例：藍色手環、備用卡

-- ========== 4. 讀卡站（教室平板、Raspberry Pi） ==========
create table devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,                     -- 例：一樓櫃台平板
  room text,                              -- 這台放在哪間教室（用來對應上課教室）
  key_hash text not null unique,          -- 讀卡站金鑰的 SHA-256；原始金鑰只顯示一次
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- 每一次刷卡都留下紀錄（包含不認得的卡，方便在後台綁定新卡）
create table card_scans (
  id bigint generated always as identity primary key,
  uid text not null,
  device_id uuid references devices (id) on delete set null,
  result text not null,                   -- checkin / checkout / already / no_session / unknown / revoked / teacher_in / teacher_out
  student_id uuid references students (id) on delete set null,
  teacher_id uuid references teachers (id) on delete set null,
  attendance_id uuid references attendance (id) on delete set null,
  scanned_at timestamptz not null default now()
);
create index on card_scans (scanned_at desc);
create index on card_scans (uid);

-- ========== 5. 出席：補下課時間與來源 ==========
alter table attendance
  add column checked_out_at timestamptz,
  add column source text not null default 'manual' check (source in ('card', 'manual')),
  add column note text,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

-- 開班：上課星期與時間（建立堂次用），教室已有 room 欄位
alter table classes
  add column note text,
  add column created_at timestamptz not null default now();

create index on sessions (starts_at);
create index on sessions (class_id, starts_at);
create index on enrollments (class_id);
create index on attendance (student_id);
create index on teacher_attendance (teacher_id, check_in_at desc);

-- ========== 6. 新學生自動建立遊戲角色 ==========
create or replace function create_avatar_for_student() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into avatars (student_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger trg_student_avatar
  after insert on students
  for each row execute function create_avatar_for_student();

-- 既有學生補建角色
insert into avatars (student_id) select id from students on conflict do nothing;

-- ========== 7. 出席 → 經驗值與裝備（改版） ==========
-- 修正：
--   a. 從「缺席／請假」改成「出席／遲到」時也會發獎勵（原本只有新增時才發）
--   b. 這堂課沒有指定教案時，仍給主修路線 10 點基本經驗值
--   c. 自動記下當天使用的教案版本
create or replace function stamp_attendance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lesson_version is null then
    select l.version into new.lesson_version
      from sessions s join lessons l on l.id = s.lesson_id where s.id = new.session_id;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger trg_attendance_stamp
  before insert or update on attendance
  for each row execute function stamp_attendance();

create or replace function grant_rewards_on_attendance() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_lesson uuid;
  v_major major_code;
  v_xp int;
begin
  if new.status not in ('present', 'late') then return new; end if;
  -- 更新時：原本就已經是出席／遲到，就不重複發
  if tg_op = 'UPDATE' and old.status in ('present', 'late') then return new; end if;

  select s.lesson_id, c.major into v_lesson, v_major
    from sessions s join classes cl on cl.id = s.class_id join courses c on c.id = cl.course_id
    where s.id = new.session_id;

  if v_lesson is not null then
    insert into student_items (student_id, item_id, attendance_id)
      select new.student_id, r.item_id, new.id from lesson_rewards r where r.lesson_id = v_lesson
      on conflict do nothing;
  end if;

  if v_major is not null then
    select coalesce(sum(r.xp), 10) into v_xp from lesson_rewards r where r.lesson_id = v_lesson;
    insert into avatar_xp (student_id, track, xp) values (new.student_id, v_major, coalesce(v_xp, 10))
      on conflict (student_id, track) do update set xp = avatar_xp.xp + excluded.xp;
  end if;
  return new;
end $$;

drop trigger if exists trg_attendance_rewards on attendance;
create trigger trg_attendance_rewards
  after insert or update of status on attendance
  for each row execute function grant_rewards_on_attendance();

-- ========== 8. 刷卡簽到（讀卡站呼叫） ==========
-- 輸入卡號與讀卡站，回傳要在畫面上顯示的內容（只含暱稱，不含真實姓名）。
-- 規則：
--   學生：找「今天、已報名、開課前 30 分鐘到下課」的堂次 → 記出席（開課 10 分鐘後算遲到）
--         已簽到且超過 30 分鐘再刷 → 記下課；找不到堂次 → 只打招呼，請老師處理
--   老師：沒有未結束的上班紀錄 → 上班；有 → 下班
create or replace function checkin_by_card(p_uid text, p_device uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid text := upper(regexp_replace(coalesce(p_uid, ''), '[^0-9A-Za-z]', '', 'g'));
  v_card cards%rowtype;
  v_room text;
  v_now timestamptz := now();
  v_student students%rowtype;
  v_teacher teachers%rowtype;
  v_session record;
  v_att attendance%rowtype;
  v_status attendance_status;
  v_ta teacher_attendance%rowtype;
  v_result text;
  v_items jsonb := '[]';
  v_xp jsonb := '[]';
begin
  if length(v_uid) < 4 or length(v_uid) > 40 then
    return jsonb_build_object('result', 'invalid');
  end if;

  if p_device is not null then
    select room into v_room from devices where id = p_device and active;
    update devices set last_seen_at = v_now where id = p_device;
  end if;

  select * into v_card from cards where uid = v_uid;
  if not found then
    insert into card_scans (uid, device_id, result) values (v_uid, p_device, 'unknown');
    return jsonb_build_object('result', 'unknown', 'uid', v_uid);
  end if;
  if v_card.revoked_at is not null then
    insert into card_scans (uid, device_id, result, student_id, teacher_id)
      values (v_uid, p_device, 'revoked', v_card.student_id, v_card.teacher_id);
    return jsonb_build_object('result', 'revoked');
  end if;

  -- ---------- 老師 ----------
  if v_card.teacher_id is not null then
    select * into v_teacher from teachers where id = v_card.teacher_id;
    if not v_teacher.active then
      insert into card_scans (uid, device_id, result, teacher_id) values (v_uid, p_device, 'revoked', v_teacher.id);
      return jsonb_build_object('result', 'revoked');
    end if;
    select * into v_ta from teacher_attendance
      where teacher_id = v_teacher.id and check_out_at is null
        and check_in_at > v_now - interval '16 hours'
      order by check_in_at desc limit 1;
    if found then
      if v_now - v_ta.check_in_at < interval '2 minutes' then
        v_result := 'already';
      else
        update teacher_attendance set check_out_at = v_now where id = v_ta.id;
        v_result := 'teacher_out';
      end if;
    else
      insert into teacher_attendance (teacher_id, check_in_at) values (v_teacher.id, v_now);
      v_result := 'teacher_in';
    end if;
    insert into card_scans (uid, device_id, result, teacher_id) values (v_uid, p_device, v_result, v_teacher.id);
    return jsonb_build_object('result', v_result, 'who', 'teacher',
      'name', coalesce(v_teacher.nickname, v_teacher.name));
  end if;

  -- ---------- 學生 ----------
  select * into v_student from students where id = v_card.student_id;
  if not found or not v_student.active then
    insert into card_scans (uid, device_id, result, student_id) values (v_uid, p_device, 'revoked', v_card.student_id);
    return jsonb_build_object('result', 'revoked');
  end if;

  -- 找最適合的堂次：同教室優先，再來是開課時間最接近的
  select s.id, s.starts_at, s.ends_at, cl.name as class_name, cl.room
    into v_session
    from sessions s
    join classes cl on cl.id = s.class_id
    join enrollments e on e.class_id = cl.id and e.student_id = v_student.id and e.status = 'active'
    where v_now between s.starts_at - interval '30 minutes' and s.ends_at + interval '30 minutes'
    order by coalesce(cl.room = v_room, false) desc, abs(extract(epoch from s.starts_at - v_now))
    limit 1;

  if not found then
    insert into card_scans (uid, device_id, result, student_id) values (v_uid, p_device, 'no_session', v_student.id);
    return jsonb_build_object('result', 'no_session', 'who', 'student', 'nickname', v_student.nickname);
  end if;

  select * into v_att from attendance where session_id = v_session.id and student_id = v_student.id;
  v_status := case when v_now > v_session.starts_at + interval '10 minutes' then 'late' else 'present' end;

  if not found then
    insert into attendance (session_id, student_id, status, checked_in_at, card_uid, source)
      values (v_session.id, v_student.id, v_status, v_now, v_uid, 'card')
      returning * into v_att;
    v_result := 'checkin';
  elsif v_att.status in ('absent', 'leave') then
    -- 老師先標了缺席／請假，孩子其實來了：改成出席（觸發器會補發獎勵）
    update attendance set status = v_status, checked_in_at = v_now, card_uid = v_uid, source = 'card'
      where id = v_att.id returning * into v_att;
    v_result := 'checkin';
  elsif v_att.checked_in_at is not null and v_now - v_att.checked_in_at > interval '30 minutes' then
    update attendance set checked_out_at = v_now where id = v_att.id returning * into v_att;
    v_result := 'checkout';
  else
    v_result := 'already';
  end if;

  insert into card_scans (uid, device_id, result, student_id, attendance_id)
    values (v_uid, p_device, v_result, v_student.id, v_att.id);

  -- 這次簽到解鎖的裝備
  select coalesce(jsonb_agg(jsonb_build_object('code', i.code, 'name', i.name, 'slot', i.slot,
           'rarity', i.rarity, 'image', i.image_path)), '[]')
    into v_items
    from student_items si join items i on i.id = si.item_id
    where si.attendance_id = v_att.id;

  select coalesce(jsonb_agg(jsonb_build_object('track', track, 'xp', xp)), '[]')
    into v_xp from avatar_xp where student_id = v_student.id;

  return jsonb_build_object(
    'result', v_result, 'who', 'student', 'nickname', v_student.nickname,
    'class', v_session.class_name, 'status', v_att.status,
    'items', case when v_result = 'checkin' then v_items else '[]'::jsonb end,
    'xp', v_xp);
end $$;

-- 只有伺服器（service role）可以呼叫，瀏覽器不能直接呼叫
revoke all on function checkin_by_card(text, uuid) from public, anon, authenticated;

-- ========== 9. 建立一個班的所有堂次 ==========
-- 從第一堂的日期時間開始，每 p_every_days 天一堂，共 p_count 堂；
-- 若課程已有教案，依序把第 1、2、3… 堂教案掛上去。
create or replace function generate_sessions(
  p_class uuid, p_first timestamptz, p_count int, p_minutes int default 90, p_every_days int default 7)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_course uuid;
  i int;
  v_lesson uuid;
begin
  if p_count < 1 or p_count > 60 then raise exception '堂數要在 1 到 60 之間'; end if;
  select course_id into v_course from classes where id = p_class;
  if v_course is null then raise exception '找不到這個班'; end if;
  for i in 0 .. p_count - 1 loop
    select id into v_lesson from lessons where course_id = v_course order by seq offset i limit 1;
    insert into sessions (class_id, lesson_id, starts_at, ends_at)
      values (p_class, v_lesson,
              p_first + make_interval(days => i * p_every_days),
              p_first + make_interval(days => i * p_every_days, mins => p_minutes));
  end loop;
  return p_count;
end $$;
revoke all on function generate_sessions(uuid, timestamptz, int, int, int) from public, anon, authenticated;

-- ========== 10. 權限（RLS） ==========
alter table student_guardians enable row level security;
alter table devices enable row level security;
alter table card_scans enable row level security;
-- devices、card_scans 不開放任何前端讀取，只有伺服器可用。

-- 家長端（第 3 階段登入後使用）：只能看自己孩子的資料
create or replace function my_student_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select sg.student_id from student_guardians sg join guardians g on g.id = sg.guardian_id
  where g.auth_user_id = auth.uid()
$$;

create policy "guardian reads own links" on student_guardians for select
  using (student_id in (select my_student_ids()));
create policy "guardian reads own students" on students for select
  using (id in (select my_student_ids()));
create policy "guardian reads own avatars" on avatars for select
  using (student_id in (select my_student_ids()));
create policy "guardian reads own items" on student_items for select
  using (student_id in (select my_student_ids()));
create policy "guardian reads own xp" on avatar_xp for select
  using (student_id in (select my_student_ids()));
create policy "guardian reads own attendance" on attendance for select
  using (student_id in (select my_student_ids()));

commit;

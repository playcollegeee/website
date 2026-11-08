-- 0016：活動報名、工作坊總覽、活動名單與標籤
--
-- 結構（由上到下）：
--   activities（0015，官網活動卡片：積木故事屋、3D 造物工作坊…）
--     └ activity_themes 主題（飆速遙控計畫、萬聖節積木派對…，可列進官網「工作坊總覽」）
--         ├ activity_theme_photos 主題照片（多張）
--         ├ activity_interests 「我想上這堂」湊班登記
--         └ activity_runs 開課（一次招生：價格方案、報名模式、退費條文、自訂題目）
--             └ activity_slots 場次（地點、名額、最低開課人數、上課時間，可多天）
--                 └ activity_bookings 報名（聯絡人、方案、金額、末五碼、狀態、同意紀錄）
--                     └ activity_booking_people 參加者（孩子或大人）
--   contact_families 活動名單：一支電話＝一個家庭（家長或成人本人）
--     └ contact_people 名單裡的人（孩子或成人），年級會隨學年自動推算
--   contact_tags／contact_person_tags 手動標籤（自動標籤由程式依報名紀錄算出，不另存）
--   activity_notices 通知紀錄（私訊、Email 哪一則、誰在什麼時間送出）
--   activity_settings 設定（匯款資訊、退費辦法範本、私訊範本…）
--
-- 全部只有伺服器（service key）能讀寫，都開 RLS、不開放任何 policy。
-- 活動名單不是學生資料庫：不建角色、不發卡，之後報名主修時再轉成正式學生。

-- ---------- 主題 ----------
create table if not exists activity_themes (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references activities (id) on delete set null,   -- 屬於哪個活動系列（可空）
  title text not null,                                               -- 例：飆速遙控計畫
  slug text not null unique,                                         -- 網址用，例：rc-car
  showcase text not null default 'none'
    check (showcase in ('none', '3d', 'kids')),                      -- 工作坊總覽分類：不列出／3D 造物工作坊／幼兒主題活動
  series text,                                                       -- 系列名稱，例：小小職人系列
  summary text not null default '',                                  -- 介紹
  highlights text[] not null default '{}',                           -- 課程特色（一行一點）
  audience_text text,                                                -- 適合對象，例：國小三年級以上
  duration_text text,                                                -- 時長，例：3 個週日，共 15 小時
  includes_text text,                                                -- 費用已含
  notes_text text,                                                   -- 備註，例：需自備一台筆電
  cover_url text,
  cover_path text,
  sort int not null default 0,
  published boolean not null default true,
  created_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists activity_themes_sort on activity_themes (showcase, sort);

create table if not exists activity_theme_photos (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references activity_themes (id) on delete cascade,
  url text not null,
  storage_path text,
  width int not null default 1200,
  height int not null default 900,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists activity_theme_photos_theme on activity_theme_photos (theme_id, sort);

-- ---------- 開課（一次招生） ----------
create table if not exists activity_runs (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references activity_themes (id) on delete restrict,
  title text,                                                        -- 這次的標題（空白就用主題名稱），例：7 月份主題【追風小勇士】
  intro text,                                                        -- 這次的補充說明（空白就用主題介紹）
  status text not null default 'draft'
    check (status in ('draft', 'open', 'closed', 'done')),           -- 草稿／報名中／停止報名／已結束
  who text not null default 'kids'
    check (who in ('kids', 'family', 'adult', 'any')),               -- 孩子參加／親子一起（記孩子）／大人自己／大人小孩都可以
  unit text not null default 'person'
    check (unit in ('person', 'group')),                             -- 名額算「人」或「組」
  pay_mode text not null default 'now'
    check (pay_mode in ('now', 'after_confirm')),                    -- 填單即匯款／確定開課後才匯款
  prices jsonb not null default '[]',                                -- [{key, label, amount, seats, returning_only}]
  questions jsonb not null default '[]',                             -- 自訂題目 [{key, label, type: text|choice, options, required}]
  refund_text text,                                                  -- 退費辦法（空白就用設定裡的範本）
  deadline date,                                                     -- 報名截止日（台灣日期，含當天）
  reminder_days int not null default 2 check (reminder_days between 0 and 14),
  cover_url text,                                                    -- 這次的海報或封面（空白用主題封面）
  cover_path text,
  created_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists activity_runs_theme on activity_runs (theme_id, created_at desc);

-- ---------- 場次 ----------
create table if not exists activity_slots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references activity_runs (id) on delete cascade,
  label text not null,                                               -- 例：台中場、第一梯
  area text,                                                         -- 地區：台中／新竹／彰化（名單標籤用）
  venue text,                                                        -- 地點名稱，例：閃亮之星公寓大廈 綜合會議室
  address text,
  times jsonb not null default '[]',                                 -- 上課時間 [{start, end}]（ISO，可多天、上下午分段）
  first_start timestamptz,                                           -- 第一堂開始時間（排序與課前提醒用，存檔時由程式算好）
  capacity int not null default 6 check (capacity between 1 and 500),
  min_seats int not null default 3 check (min_seats between 0 and 500),
  state text not null default 'open'
    check (state in ('open', 'confirmed', 'cancelled')),             -- 招生中／確定開課／停課
  waitlist boolean not null default true,                            -- 額滿後可登記候補
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists activity_slots_run on activity_slots (run_id, sort);
create index if not exists activity_slots_start on activity_slots (first_start);

-- ---------- 活動名單 ----------
create table if not exists contact_families (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,                                        -- 只留數字與 +，同一支電話＝同一個家庭
  name text not null,                                                -- 聯絡人（家長，或大人自己）
  email text,
  social_name text,                                                  -- 私訊粉專／IG 用的名字
  marketing boolean not null default false,                          -- 願意收到後續工作坊與課程資訊
  marketing_at timestamptz,
  photo_ok boolean,                                                  -- 最近一次報名的照片同意
  note text,                                                         -- 老師備註
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contact_people (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references contact_families (id) on delete cascade,
  kind text not null check (kind in ('child', 'adult')),
  name text not null,
  grade int,                                                         -- 報名當年的年級：-3 幼幼、-2 小班、-1 中班、0 大班、1–6 小一～小六、7–9 國一～國三、10–12 高中
  grade_year int,                                                    -- 記錄年級時的學年度（西元，8 月起算新學年）
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, kind, name)
);
create index if not exists contact_people_family on contact_people (family_id);

create table if not exists contact_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'gray' check (color in ('gray', 'yellow', 'green', 'red', 'blue')),
  created_at timestamptz not null default now()
);

create table if not exists contact_person_tags (
  person_id uuid not null references contact_people (id) on delete cascade,
  tag_id uuid not null references contact_tags (id) on delete cascade,
  created_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (person_id, tag_id)
);

-- ---------- 報名 ----------
create table if not exists activity_bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                                         -- 報名編號，例：A7K2Q9
  token text not null,                                               -- 家長查詢／回填末五碼連結的金鑰（老師產生私訊稿時要放進連結，所以存原文；只有伺服器讀得到）
  run_id uuid not null references activity_runs (id) on delete restrict,
  slot_id uuid not null references activity_slots (id) on delete restrict,
  family_id uuid references contact_families (id) on delete set null,
  status text not null default 'pending'
    check (status in ('registered', 'pending', 'paid', 'waitlist', 'cancelled', 'refunded')),
    -- registered 已登記（確定開課後才匯款）／pending 待匯款或待對帳／paid 已確認／waitlist 候補／cancelled 取消／refunded 已退款
  price_key text not null,
  price_label text not null,
  qty int not null default 1 check (qty between 1 and 10),
  seats int not null check (seats between 1 and 50),                 -- 佔用名額（人或組）
  amount int not null check (amount >= 0),                           -- 應繳金額
  claims_returning boolean not null default false,                   -- 選了舊生方案
  is_returning boolean not null default false,                       -- 系統查到以前參加過
  contact_name text not null,
  phone text not null,
  email text,
  social_name text,
  pay_last5 text,
  pay_reported_at timestamptz,
  paid_at timestamptz,
  paid_by uuid references teachers (id) on delete set null,
  refund_amount int,
  cancel_reason text,
  cancelled_at timestamptz,
  answers jsonb not null default '{}',                               -- 自訂題目的回答
  message text,                                                      -- 家長留言
  admin_note text,
  refund_ack_at timestamptz not null,                                -- 已閱讀退費辦法
  consent_version text not null,
  photo_ok boolean not null default false,
  marketing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists activity_bookings_slot on activity_bookings (slot_id, status);
create index if not exists activity_bookings_run on activity_bookings (run_id, created_at);
create index if not exists activity_bookings_family on activity_bookings (family_id);

create table if not exists activity_booking_people (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references activity_bookings (id) on delete cascade,
  person_id uuid references contact_people (id) on delete set null,
  kind text not null check (kind in ('child', 'adult')),
  name text not null,
  grade int,
  care_notes text,                                                   -- 過敏或需要注意的地方（需另外勾同意）
  care_consent_at timestamptz,
  sort int not null default 0,
  check (care_notes is null or care_consent_at is not null)
);
create index if not exists activity_booking_people_booking on activity_booking_people (booking_id);
create index if not exists activity_booking_people_person on activity_booking_people (person_id);

create table if not exists activity_notices (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references activity_bookings (id) on delete cascade,
  kind text not null check (kind in ('registered', 'pay', 'paid', 'reminder', 'cancelled', 'waitlist_open', 'custom')),
  channel text not null check (channel in ('dm', 'email')),
  sent_by uuid references teachers (id) on delete set null,
  sent_at timestamptz not null default now()
);
create index if not exists activity_notices_booking on activity_notices (booking_id, kind);

create table if not exists activity_interests (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references activity_themes (id) on delete cascade,
  family_id uuid references contact_families (id) on delete set null,
  contact_name text not null,
  phone text not null,
  email text,
  social_name text,
  headcount int not null default 1 check (headcount between 1 and 30),
  who_text text,                                                     -- 參加者說明，例：小四、小二兄妹
  prefer_text text,                                                  -- 方便的時間或地區
  status text not null default 'new' check (status in ('new', 'notified', 'closed')),
  created_at timestamptz not null default now()
);
create index if not exists activity_interests_theme on activity_interests (theme_id, status);

create table if not exists activity_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- 權限：全部只給伺服器 ----------
alter table activity_themes enable row level security;
alter table activity_theme_photos enable row level security;
alter table activity_runs enable row level security;
alter table activity_slots enable row level security;
alter table contact_families enable row level security;
alter table contact_people enable row level security;
alter table contact_tags enable row level security;
alter table contact_person_tags enable row level security;
alter table activity_bookings enable row level security;
alter table activity_booking_people enable row level security;
alter table activity_notices enable row level security;
alter table activity_interests enable row level security;
alter table activity_settings enable row level security;

-- updated_at 自動更新（沿用 0015 的 activities_touch）
do $$
declare t text;
begin
  foreach t in array array['activity_themes', 'activity_runs', 'contact_families', 'contact_people', 'activity_bookings'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before update on %I for each row execute function activities_touch()', t, t);
  end loop;
end $$;

-- ---------- 各場次已佔用的名額（已登記、待匯款、已確認才算；候補、取消不算） ----------
create or replace view activity_slot_usage as
select s.id as slot_id,
       coalesce(sum(b.seats) filter (where b.status in ('registered', 'pending', 'paid')), 0)::int as used,
       coalesce(sum(b.seats) filter (where b.status = 'paid'), 0)::int as paid,
       coalesce(sum(b.seats) filter (where b.status = 'waitlist'), 0)::int as waiting
from activity_slots s
left join activity_bookings b on b.slot_id = s.id
group by s.id;
alter view activity_slot_usage set (security_invoker = true);

-- 學年度：8 月起算新學年（2026/8～2027/7 都是 2026）
create or replace function school_year(t timestamptz default now()) returns int
language sql stable as $$
  select (extract(year from t at time zone 'Asia/Taipei')
          - case when extract(month from t at time zone 'Asia/Taipei') < 8 then 1 else 0 end)::int
$$;

-- ---------- 報名：一次完成（鎖住場次 → 檢查名額 → 建名單 → 建報名與參加者） ----------
-- 參數 p（jsonb）：
--   slot_id, price_key, qty, contact_name, phone, email, social_name, code, token,
--   photo_ok, marketing, consent_version, answers, message,
--   people: [{kind, name, grade, care_notes, care_consent}]
-- 回傳 {code, status}；錯誤用 raise exception，訊息直接給家長看。
create or replace function book_activity(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_slot activity_slots;
  v_run activity_runs;
  v_price jsonb;
  v_qty int := greatest(1, least(10, coalesce((p->>'qty')::int, 1)));
  v_seats int;
  v_amount int;
  v_used int;
  v_status text;
  v_phone text := regexp_replace(coalesce(p->>'phone', ''), '[^0-9+]', '', 'g');
  v_family uuid;
  v_booking uuid;
  v_person uuid;
  v_returning boolean;
  v_person_json jsonb;
  v_i int := 0;
  v_sy int := school_year();
  v_kind text;
  v_name text;
  v_grade int;
begin
  select * into v_slot from activity_slots where id = (p->>'slot_id')::uuid for update;
  if not found then raise exception '找不到這個場次'; end if;
  select * into v_run from activity_runs where id = v_slot.run_id;
  if v_run.status <> 'open' then raise exception '這個活動目前沒有開放報名'; end if;
  if v_slot.state = 'cancelled' then raise exception '這個場次已停課'; end if;
  if v_run.deadline is not null and (now() at time zone 'Asia/Taipei')::date > v_run.deadline then
    raise exception '報名已截止';
  end if;
  if length(v_phone) < 8 then raise exception '電話格式看起來不正確'; end if;

  select e into v_price from jsonb_array_elements(v_run.prices) e where e->>'key' = p->>'price_key';
  if v_price is null then raise exception '請選擇報名方案'; end if;
  v_seats := greatest(1, coalesce((v_price->>'seats')::int, 1)) * v_qty;
  v_amount := greatest(0, coalesce((v_price->>'amount')::int, 0)) * v_qty;
  if jsonb_array_length(coalesce(p->'people', '[]')) <> v_seats and v_run.unit = 'person' then
    raise exception '參加者人數要和方案一致（% 位）', v_seats;
  end if;
  if jsonb_array_length(coalesce(p->'people', '[]')) < 1 then raise exception '請填寫參加者'; end if;

  select coalesce(sum(seats), 0) into v_used from activity_bookings
   where slot_id = v_slot.id and status in ('registered', 'pending', 'paid');
  if v_used + v_seats > v_slot.capacity then
    if not v_slot.waitlist then raise exception '這個場次已額滿'; end if;
    v_status := 'waitlist';
  elsif v_run.pay_mode = 'after_confirm' and v_slot.state <> 'confirmed' then
    v_status := 'registered';
  else
    v_status := 'pending';
  end if;

  -- 名單：同一支電話視為同一個家庭，更新最新的聯絡資料
  insert into contact_families as f (phone, name, email, social_name, marketing, marketing_at, photo_ok)
  values (v_phone, p->>'contact_name', nullif(p->>'email', ''), nullif(p->>'social_name', ''),
          coalesce((p->>'marketing')::boolean, false),
          case when coalesce((p->>'marketing')::boolean, false) then now() end,
          coalesce((p->>'photo_ok')::boolean, false))
  on conflict (phone) do update set
    name = excluded.name,
    email = coalesce(excluded.email, f.email),
    social_name = coalesce(excluded.social_name, f.social_name),
    -- 同意收訊息：這次有勾就記同意；沒勾不會取消以前的同意（要取消請家長告知，由老師在名單裡改）
    marketing = f.marketing or excluded.marketing,
    marketing_at = case when excluded.marketing and not f.marketing then now() else f.marketing_at end,
    photo_ok = excluded.photo_ok,
    last_seen = now()
  returning id into v_family;

  -- 舊生：這個家庭以前在「別的開課」有已確認的報名
  v_returning := exists (select 1 from activity_bookings where family_id = v_family and status = 'paid' and run_id <> v_run.id);

  insert into activity_bookings (code, token, run_id, slot_id, family_id, status, price_key, price_label, qty, seats, amount,
    claims_returning, is_returning, contact_name, phone, email, social_name, answers, message,
    refund_ack_at, consent_version, photo_ok, marketing)
  values (p->>'code', p->>'token', v_run.id, v_slot.id, v_family, v_status, v_price->>'key', v_price->>'label', v_qty, v_seats, v_amount,
    coalesce((v_price->>'returning_only')::boolean, false), v_returning, p->>'contact_name', v_phone,
    nullif(p->>'email', ''), nullif(p->>'social_name', ''), coalesce(p->'answers', '{}'), nullif(p->>'message', ''),
    now(), p->>'consent_version', coalesce((p->>'photo_ok')::boolean, false), coalesce((p->>'marketing')::boolean, false))
  returning id into v_booking;

  for v_person_json in select * from jsonb_array_elements(p->'people') loop
    v_kind := case when v_person_json->>'kind' = 'adult' then 'adult' else 'child' end;
    v_name := left(trim(coalesce(v_person_json->>'name', '')), 40);
    v_grade := nullif(v_person_json->>'grade', '')::int;
    if v_name = '' then raise exception '請填寫每一位參加者的姓名'; end if;
    insert into contact_people as cp (family_id, kind, name, grade, grade_year)
    values (v_family, v_kind, v_name, v_grade, case when v_grade is not null then v_sy end)
    on conflict (family_id, kind, name) do update set
      grade = coalesce(excluded.grade, cp.grade),
      grade_year = case when excluded.grade is not null then excluded.grade_year else cp.grade_year end
    returning id into v_person;
    insert into activity_booking_people (booking_id, person_id, kind, name, grade, care_notes, care_consent_at, sort)
    values (v_booking, v_person, v_kind, v_name, v_grade,
            nullif(left(coalesce(v_person_json->>'care_notes', ''), 300), ''),
            case when nullif(v_person_json->>'care_notes', '') is not null and coalesce((v_person_json->>'care_consent')::boolean, false) then now() end,
            v_i);
    v_i := v_i + 1;
  end loop;

  return jsonb_build_object('code', p->>'code', 'status', v_status, 'amount', v_amount);
end $$;

revoke all on function book_activity(jsonb) from public, anon, authenticated;

-- ---------- 預設設定 ----------
insert into activity_settings (key, value) values
  ('bank', ''),   -- 匯款資訊：請在後台「活動報名 → 設定」填寫（不寫進程式庫）
  ('refund', '取消與更改辦法：
＊活動匯款後「無法退全額」，請自行找人遞補
＊活動日前30天前告知取消退訂，退還總金額50%
＊活動日前10-30天告知取消退訂，退還總金額30%
＊活動日前10天內、當日告知取消退訂，將不予以退款
＊無故未報到或於中途離席者，均視為自願放棄，不予退費

若於活動開始3日內(含當天)，提出病假申請，於三天內附上病假證明提出退費申請者，將退還總金額50%。
活動前若政府宣佈颱風假等不可抗拒之因素致無法成行，我們將主動聯繫家長並安排退款。
如因特殊及傳染病或人禍(如Covid-19)，主辦單位基於消費者安全考量而取消活動，將酌收200元行政手續費後全額退款。'),
  ('team', '「玩學院」提供生動有趣的教學課程，專業的師資團隊已陪伴數千名孩子快樂學習。
老師們擁有多年豐富的營隊課程經驗與 3D 列印、樂高教學經驗，有趣的教學模式，讓孩子們在充滿樂趣的環境中，探索、學習與成長。'),
  ('dm_registered', '{家長}您好～我們收到{參加者}報名「{活動}」{場次}囉！
報名編號：{編號}
{付款說明}
有任何問題都可以直接回覆這則訊息喔😊'),
  ('dm_pay', '{家長}您好～「{活動}」{場次}確定開課囉🎉
應繳金額：{金額} 元
{匯款資訊}
匯款後請到這裡填帳號末五碼：{連結}
謝謝您！'),
  ('dm_paid', '{家長}您好～已收到您的款項，{參加者}「{活動}」報名完成🎉
上課時間：{時間}
地點：{地點}
{備註}
上課前我們會再提醒您，期待見面！'),
  ('dm_reminder', '{家長}您好～提醒您，{參加者}的「{活動}」就在 {時間} 囉！
地點：{地點}
{備註}
當天見～有問題隨時私訊我們😊'),
  ('dm_cancelled', '{家長}您好，很抱歉通知您，「{活動}」{場次}因{原因}無法如期開課。
{退款說明}
造成不便很抱歉，下次有新場次會優先通知您🙏'),
  ('dm_waitlist_open', '{家長}您好～「{活動}」{場次}有名額釋出了！
{參加者}可以遞補，應繳金額 {金額} 元。
{匯款資訊}
匯款後請到這裡填帳號末五碼：{連結}')
on conflict (key) do nothing;

-- ---------- 預先放入工作坊總覽的 4 個主題（照片是程式庫內建，之後可在後台換） ----------
insert into activity_themes (title, slug, showcase, series, summary, highlights, audience_text, duration_text, includes_text, notes_text, cover_url, sort)
select * from (values
  ('飆速遙控計畫', 'rc-car', '3d', null,
   '用三週的時間，從車體設計、3D 列印到組裝馬達與遙控器，親手打造一台專屬遙控車，最後來場競速對戰。',
   array['兩位孩子一台 3D 列印機，親自操作、觀察機器運作', '學習 3D 繪圖與切片軟體，掌握積層製造的邏輯', '車體、外觀、造型自由發揮', '完成後進行遙控挑戰與競速對戰'],
   '國小三年級以上', '3 個週日，上午＋下午，共 15 小時', '講師費、場地費、3D 列印耗材、活動教材、馬達與遙控器', '需自備一台筆電；午餐自理',
   '/workshops/rc-1.webp', 1),
  ('我的微縮城市計畫', 'mini-city', '3d', null,
   '從觀察城市、畫草圖開始，用 3D 建模設計建築與街道，再列印、上色、組合成一座屬於自己的微縮城市。',
   array['從手繪草圖到 3D 建模', '認識比例、結構與空間規劃', '親手列印、組裝自己的城市模型', '最後舉辦成果發表'],
   '國小三年級以上', '連續 5 天，每天上午', '講師費、場地費、3D 列印耗材、活動教材', '需自備一台筆電',
   '/workshops/city-1.webp', 2),
  ('萬聖節積木派對', 'halloween-party', 'kids', null,
   '親子一起動手組裝獨一無二的「積木南瓜桶」，完成後提著自己做的南瓜桶「不給糖就搗蛋」，派對結束直接帶回家。',
   array['親子一起組裝積木南瓜桶', '萬聖節裝扮與故事互動', '提著南瓜桶不給糖就搗蛋', '作品直接帶回家'],
   '3–6 歲幼兒（親子）', '約 90 分鐘', '報名費、積木南瓜桶材料', null,
   '/workshops/halloween-1.webp', 3),
  ('小小調飲師', 'little-barista', 'kids', '小小職人系列',
   '從繪本出發，親手組裝「積木攪拌機」，再變身小小調飲師，調出一杯真的飲品，從想像到實現。',
   array['繪本引導，認識飲料店的工作', '動手組裝會轉動的積木攪拌機', '親手調一杯真的飲品', '積木攪拌機帶回家'],
   '3–7 歲幼兒（親子）', '約 90 分鐘', '報名費、積木攪拌機材料、飲品材料', '有食物過敏請在報名時註明',
   '/workshops/drink-1.webp', 4)
) as v(title, slug, showcase, series, summary, highlights, audience_text, duration_text, includes_text, notes_text, cover_url, sort)
where not exists (select 1 from activity_themes);

insert into activity_theme_photos (theme_id, url, width, height, sort)
select t.id, p.url, p.w, p.h, p.s
from activity_themes t
join (values
  ('rc-car', '/workshops/rc-1.webp', 1200, 1600, 1), ('rc-car', '/workshops/rc-2.webp', 900, 1600, 2), ('rc-car', '/workshops/rc-3.webp', 1200, 1600, 3),
  ('rc-car', '/workshops/rc-4.webp', 1200, 1600, 4), ('rc-car', '/workshops/rc-5.webp', 1200, 1600, 5),
  ('mini-city', '/workshops/city-1.webp', 1200, 1600, 1), ('mini-city', '/workshops/city-2.webp', 1200, 1600, 2), ('mini-city', '/workshops/city-3.webp', 1600, 1200, 3),
  ('mini-city', '/workshops/city-4.webp', 1200, 1600, 4), ('mini-city', '/workshops/city-5.webp', 1200, 1600, 5),
  ('halloween-party', '/workshops/halloween-1.webp', 1477, 1108, 1), ('halloween-party', '/workshops/halloween-2.webp', 1477, 1108, 2), ('halloween-party', '/workshops/halloween-3.webp', 1477, 1108, 3),
  ('halloween-party', '/workshops/halloween-4.webp', 1600, 1200, 4), ('halloween-party', '/workshops/halloween-5.webp', 1477, 1108, 5),
  ('little-barista', '/workshops/drink-1.webp', 1200, 1600, 1), ('little-barista', '/workshops/drink-2.webp', 1200, 1600, 2), ('little-barista', '/workshops/drink-3.webp', 1200, 1600, 3),
  ('little-barista', '/workshops/drink-4.webp', 1200, 1600, 4), ('little-barista', '/workshops/drink-5.webp', 1200, 1600, 5)
) as p(slug, url, w, h, s) on p.slug = t.slug
where not exists (select 1 from activity_theme_photos);

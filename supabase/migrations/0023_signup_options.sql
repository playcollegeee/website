-- 0023：活動報名表調整
--   1. 方案可以複選（例：兩人同行 1 份＋單人 1 份），報名紀錄多一欄 items 記每個方案幾份
--   2. 主題可以設定年級範圍（grade_min／grade_max），報名表的年級選項只列出範圍內的年級
--      年級：-3 幼幼、-2 小班、-1 中班、0 大班、1–6 小一～小六、7–9 國一～國三、10–12 高一～高三；空白＝不限

alter table activity_themes add column if not exists grade_min int check (grade_min between -3 and 12);
alter table activity_themes add column if not exists grade_max int check (grade_max between -3 and 12);
alter table activity_bookings add column if not exists items jsonb;

-- 依現有的「適合對象」文字先填好（之後在後台主題頁修改）
update activity_themes set grade_min = 3 where grade_min is null and grade_max is null and audience_text like '%三年級以上%';
update activity_themes set grade_min = 1, grade_max = 4 where grade_min is null and grade_max is null and audience_text like '%一年級%四年級%';
update activity_themes set grade_min = -3, grade_max = 0 where grade_min is null and grade_max is null and audience_text like '3–6 歲%';
update activity_themes set grade_min = -3, grade_max = 1 where grade_min is null and grade_max is null and audience_text like '3–7 歲%';

create or replace function book_activity(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_slot activity_slots;
  v_run activity_runs;
  v_price jsonb;
  v_items jsonb;
  v_item jsonb;
  v_n int;
  v_label text := '';
  v_first_key text;
  v_claims boolean := false;
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

  -- 方案可以複選：items = [{key, qty}]；舊格式（price_key＋qty）也接受
  v_items := case when jsonb_typeof(p->'items') = 'array' and jsonb_array_length(p->'items') > 0 then p->'items'
                  else jsonb_build_array(jsonb_build_object('key', p->>'price_key', 'qty', v_qty)) end;
  v_seats := 0; v_amount := 0;
  for v_item in select * from jsonb_array_elements(v_items) loop
    v_n := greatest(0, least(10, coalesce((v_item->>'qty')::int, 0)));
    continue when v_n = 0;
    select e into v_price from jsonb_array_elements(v_run.prices) e where e->>'key' = v_item->>'key';
    if v_price is null then raise exception '請選擇報名方案'; end if;
    v_seats := v_seats + greatest(1, coalesce((v_price->>'seats')::int, 1)) * v_n;
    v_amount := v_amount + greatest(0, coalesce((v_price->>'amount')::int, 0)) * v_n;
    v_label := v_label || case when v_label = '' then '' else '＋' end || (v_price->>'label') || '×' || v_n;
    v_first_key := coalesce(v_first_key, v_price->>'key');
    v_claims := v_claims or coalesce((v_price->>'returning_only')::boolean, false);
  end loop;
  if v_seats = 0 then raise exception '請選擇報名方案'; end if;
  if v_seats > 20 then raise exception '一次最多報名 20 位，人數較多請私訊我們'; end if;
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
    refund_ack_at, consent_version, photo_ok, marketing, items)
  values (p->>'code', p->>'token', v_run.id, v_slot.id, v_family, v_status, v_first_key, v_label, 1, v_seats, v_amount,
    v_claims, v_returning, p->>'contact_name', v_phone,
    nullif(p->>'email', ''), nullif(p->>'social_name', ''), coalesce(p->'answers', '{}'), nullif(p->>'message', ''),
    now(), p->>'consent_version', coalesce((p->>'photo_ok')::boolean, false), coalesce((p->>'marketing')::boolean, false), v_items)
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

-- 玩學院整合系統：老師線上打卡（外派地點也能上下班打卡）
-- 老師在手機登入後台按「上班／下班」，記下地點與手機定位（定位選填）。
-- 與教室刷卡共用 teacher_attendance，一筆紀錄 = 一次上班到下班。
-- 在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。不會刪除既有資料。

begin;

alter table teacher_attendance
  add column source text not null default 'card'
    check (source in ('card', 'online', 'manual')),        -- 上班方式：教室刷卡／線上打卡／管理員補登
  add column check_out_source text
    check (check_out_source in ('card', 'online', 'manual')),
  add column location text,                                -- 地點：教室或外派地點名稱
  add column check_in_lat double precision,                -- 打卡當下的手機定位（老師允許時才有）
  add column check_in_lng double precision,
  add column check_in_accuracy int,                        -- 定位誤差（公尺）
  add column check_out_lat double precision,
  add column check_out_lng double precision,
  add column check_out_accuracy int,
  add column note text,
  add column edited_by uuid references teachers (id) on delete set null,  -- 管理員修改過
  add column edited_at timestamptz;

-- 教室刷卡下班時（checkin_by_card 只更新 check_out_at），自動標記為刷卡
create or replace function stamp_teacher_checkout() returns trigger
language plpgsql as $$
begin
  if new.check_out_at is not null and old.check_out_at is null and new.check_out_source is null then
    new.check_out_source := 'card';
  end if;
  return new;
end $$;

create trigger trg_teacher_checkout_source
  before update on teacher_attendance
  for each row execute function stamp_teacher_checkout();

commit;

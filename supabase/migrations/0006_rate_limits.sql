-- 0006：次數限制（防止猜密碼、狂送假表單、亂刷卡）
-- 每個「用途＋來源」一筆計數，例：login-ip:<雜湊後的 IP>、trial:<雜湊後的 IP>
-- 只存雜湊值，不存原始 IP，避免多保存個資

create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);

-- 只有伺服器（service key）能用
alter table rate_limits enable row level security;

-- 記一次並回傳「是否還在允許範圍內」：true = 可以繼續，false = 太頻繁
create or replace function hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  insert into rate_limits as t (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when t.window_start < now() - make_interval(secs => p_window_seconds) then 1 else t.count + 1 end,
    window_start = case when t.window_start < now() - make_interval(secs => p_window_seconds) then now() else t.window_start end
  returning count into n;

  -- 偶爾順手清掉一天以前的舊紀錄
  if random() < 0.02 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  return n <= p_limit;
end $$;

revoke all on function hit_rate_limit(text, int, int) from public, anon, authenticated;

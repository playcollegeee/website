-- 0021：官網設定（區塊開關等），後台「官網區塊開關」修改
-- key＝設定名稱，value＝內容（jsonb）。目前只有 sections：{ trial, ribbon, quests }，true＝顯示在官網
create table if not exists site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references teachers (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- 只有伺服器（service key）讀寫
alter table site_settings enable row level security;

-- 2026-11-15 使用者決定：預約試聽、標語跑馬燈、「選擇任務」先不顯示
insert into site_settings (key, value)
values ('sections', '{"trial": false, "ribbon": false, "quests": false}'::jsonb)
on conflict (key) do nothing;

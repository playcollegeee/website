-- 0015：官網「活動與工作坊」可以在後台自己新增、修改
-- 一筆＝官網上的一張活動卡片（工作坊、營隊、常態課程、講座……），可標示對象：兒童／親子／成人／不限
-- 卡片照片沿用公開 bucket「site-photos」（放在 activities/ 資料夾）

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,                                  -- 活動名稱
  kind text not null default 'workshop'
    check (kind in ('workshop', 'camp', 'class', 'talk', 'event')), -- 工作坊／營隊／常態課程／講座／活動
  audience text not null default 'kids'
    check (audience in ('kids', 'family', 'adult', 'all')),         -- 兒童／親子／成人／大人小孩都可以
  audience_text text,                                   -- 適合對象說明，例：國小三年級以上，也歡迎大人
  summary text not null default '',                     -- 介紹
  tags text[] not null default '{}',                    -- 小標籤，例：半日體驗、帶回作品
  schedule_text text,                                   -- 時間說明，例：每月第二個週六 10:00
  price_text text,                                      -- 費用（定案後才填；空白就不顯示）
  signup text not null default 'contact'
    check (signup in ('contact', 'link', 'none')),      -- 報名方式：官網詢問表單／外部連結／不顯示按鈕
  signup_url text,                                      -- 外部報名連結（signup = link 時）
  image_url text,
  storage_path text,                                    -- 上傳到 Storage 的檔名；內建照片為 null
  width int not null default 1100,
  height int not null default 825,
  sort int not null default 0,
  published boolean not null default true,
  created_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activities_sort on activities (sort, created_at);

-- 只有伺服器（service key）讀寫
alter table activities enable row level security;

create or replace function activities_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists activities_touch on activities;
create trigger activities_touch before update on activities
for each row execute function activities_touch();

-- 先放入目前官網上的 4 個活動，後台一打開就能直接改
insert into activities (title, kind, audience, audience_text, summary, tags, image_url, width, height, sort)
select * from (values
  ('積木故事屋', 'workshop', 'family', '3–6 歲幼兒（親子）',
   '從繪本故事出發，親子一起用積木完成主題作品，再進入有趣的任務挑戰。每月一個新主題。',
   array['親子', '每月主題', '約 60–70 分鐘'], '/images/story-ship.webp', 640, 480, 1),
  ('樂高動滋動', 'workshop', 'kids', '幼兒至國小低年級',
   '用樂高做出會動的作品，在玩的過程裡認識齒輪、槓桿與力的方向。',
   array['動力機械', '主題課程'], '/images/lego-car.webp', 640, 480, 2),
  ('3D 造物體驗工作坊', 'workshop', 'kids', '國小三年級以上',
   '半日工作坊，從設計到列印，帶走一件自己設計的作品，例如冰箱貼、機關公仔。',
   array['半日體驗', '帶回作品'], '/images/print-proud.webp', 640, 480, 3),
  ('3D 列印寒暑假營隊', 'camp', 'kids', '國小三年級以上',
   '連續多天的主題專題，例如「我的微縮城市計畫」「桌遊嘉年華」「飆速遙控計畫」，最後舉辦成果發表。',
   array['寒暑假', '專題', '成果發表'], '/images/boardgame.webp', 640, 480, 4)
) as v(title, kind, audience, audience_text, summary, tags, image_url, width, height, sort)
where not exists (select 1 from activities);

-- 0004：官網照片可以在後台自己上傳、更換、改文字
-- 對象：首頁「成果與活動紀錄」(highlights) 與「教室現場」作品牆 (gallery)
-- 照片檔放在 Supabase Storage 的公開 bucket「site-photos」（官網要讓所有人看得到）

create table if not exists site_photos (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('highlights', 'gallery')),
  title text not null,                 -- 成果紀錄：標題；作品牆：照片說明
  tag text,                            -- 成果紀錄：時間標籤（例：2026・夏）
  body text,                           -- 成果紀錄：一兩句介紹
  color text not null default 'yellow' check (color in ('yellow', 'green', 'red', 'blue')),
  image_url text not null,             -- 網址：/images/... 或 Storage 公開網址
  storage_path text,                   -- 上傳到 Storage 的檔名（更換或刪除時一併刪檔）；內建照片為 null
  width int not null default 1100,
  height int not null default 825,
  sort int not null default 0,
  published boolean not null default true,
  created_by uuid references teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_photos_section_sort on site_photos (section, sort);

-- 只有伺服器（service key）讀寫；不開放瀏覽器直接存取
alter table site_photos enable row level security;

create or replace function site_photos_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists site_photos_touch on site_photos;
create trigger site_photos_touch before update on site_photos
for each row execute function site_photos_touch();

-- 先放入目前官網上的照片，後台一打開就能直接改
insert into site_photos (section, title, tag, body, color, image_url, width, height, sort)
select * from (values
  ('highlights', '3D 列印夏令營：桌遊嘉年華', '2026・夏', '孩子自己設計規則、建模、列印配件，完成一套能玩的桌遊。', 'red', '/images/build-focus.webp', 825, 1100, 1),
  ('highlights', '飆速遙控計畫', '2026・6 月', '三天工作坊從設計車殼到組裝遙控車，最後挑戰駕照關卡並舉辦成果發表。', 'green', '/images/rc-car.webp', 825, 1100, 2),
  ('highlights', '我的微縮城市計畫', '2026・冬', '每個孩子設計一棟建築，最後拼成一座 3D 列印的微縮城市。', 'blue', '/images/city-modeling.webp', 825, 1100, 3),
  ('gallery', '積木故事屋：小小釣手', null, null, 'yellow', '/images/story-ship.webp', 1100, 825, 1),
  ('gallery', '樂高動滋動：完成自己的風帆車', null, null, 'yellow', '/images/lego-car.webp', 825, 1100, 2),
  ('gallery', '3D 造物：拿著自己列印的作品', null, null, 'yellow', '/images/print-proud.webp', 825, 1100, 3),
  ('gallery', '萬聖節積木派對', null, null, 'yellow', '/images/halloween.webp', 1100, 825, 4),
  ('gallery', '飆速遙控計畫：駕照關卡', null, null, 'yellow', '/images/rc-car.webp', 825, 1100, 5),
  ('gallery', '微縮城市計畫：3D 建模中', null, null, 'yellow', '/images/city-modeling.webp', 1100, 825, 6)
) as v(section, title, tag, body, color, image_url, width, height, sort)
where not exists (select 1 from site_photos);

-- 照片 bucket：公開讀取，單檔最大 5 MB，只收圖片
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-photos', 'site-photos', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

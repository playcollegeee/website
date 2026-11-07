-- 玩學院整合系統：課程教案庫第 2 批「教案照片與組裝圖檔」
-- 內容：
--   1. lesson_files（0001 已建立）加上檔案資訊：類型、大小、尺寸、縮圖、原始檔名、排序、封面、上傳者
--   2. 私人 Storage bucket「lesson-files」：只有後台伺服器能讀寫，老師看照片／下載 .io 時由伺服器產生限時連結
-- 在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。不會刪除既有資料。

begin;

-- kind：image 成品／作品照片、model_io 組裝圖檔（BrickLink Studio .io）
alter table lesson_files
  add column if not exists file_name text,                -- 原始檔名（下載時使用）
  add column if not exists mime text,
  add column if not exists size_bytes int,
  add column if not exists width int,                     -- 照片尺寸
  add column if not exists height int,
  add column if not exists thumb_path text,               -- 照片縮圖（列表卡片用）
  add column if not exists sort int not null default 0,
  add column if not exists is_cover boolean not null default false,  -- 教案庫列表顯示的封面照片
  add column if not exists uploaded_by uuid references teachers (id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

create index if not exists lesson_files_lesson_kind on lesson_files (lesson_id, kind, sort);
-- 每個教案最多一張封面
create unique index if not exists lesson_files_one_cover on lesson_files (lesson_id) where is_cover;

-- 私人 bucket：單檔最大 10 MB，只收圖片與 .io（.io 以 application/octet-stream 上傳）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lesson-files', 'lesson-files', false, 10485760,
        array['image/webp', 'image/jpeg', 'image/png', 'application/octet-stream'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

commit;

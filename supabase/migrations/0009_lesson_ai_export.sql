-- 玩學院整合系統：教案 AI 範本與匯出（課程教案庫第 3 批）
-- 內容：
--   1. 教案新增「給家長的話」與「活動簡介」（對外文字，匯出親子館／托育中心表格用）
--   2. 搜尋文字納入這兩個欄位
-- 在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。不會刪除既有資料。

begin;

alter table lessons
  add column if not exists parent_note text,   -- 給家長的話
  add column if not exists outline text;       -- 活動簡介（對外宣傳、托育中心「內容大綱」）

-- 搜尋文字是自動產生的欄位，要先拿掉再用新的公式加回來（索引一起重建）
drop index if exists lessons_search_trgm;
alter table lessons drop column if exists search_text;
alter table lessons add column search_text text generated always as (
  lower(
    coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(goals, '') || ' ' ||
    coalesce(refs, '') || ' ' || coalesce(tips, '') || ' ' || coalesce(challenge, '') || ' ' ||
    coalesce(support, '') || ' ' || coalesce(parent_note, '') || ' ' || coalesce(outline, '') || ' ' ||
    timeline::text || ' ' || materials::text
  )
) stored;
create index lessons_search_trgm on lessons using gin (search_text gin_trgm_ops);

commit;

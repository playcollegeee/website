-- 玩學院整合系統：課程規劃加上「主題」欄位
-- 規劃名稱依時間自動產生（例：2027 第1季、2027 3月份主題、2027冬令營第1梯），主題等老師討論完再填。
-- 在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。

begin;
alter table plans add column if not exists theme text check (theme is null or length(theme) <= 80);
commit;

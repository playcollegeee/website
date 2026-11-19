-- 0025：活動主題加「課程流程圖」（報名頁、主題介紹頁的「課程安排」區塊顯示）
alter table activity_themes add column if not exists flow_url text;
alter table activity_themes add column if not exists flow_path text;  -- 後台上傳的檔案位置（換圖時刪舊檔）；程式庫內建圖為空
alter table activity_themes add column if not exists flow_width int;
alter table activity_themes add column if not exists flow_height int;

-- 3D造物體驗工作坊先放入流程圖（程式庫內建，之後可在後台換）
update activity_themes
   set flow_url = '/workshops/3d-intro-flow.webp', flow_width = 1131, flow_height = 1600
 where slug = '3d-intro' and flow_url is null;

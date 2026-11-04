-- 玩學院整合系統：線上新生報名表
-- 家長在官網 /enroll 填寫 → 存進 registration_requests（待審核）→ 老師在後台審核通過 → 建立家長、學生、遊戲角色。
-- 同時補上：照片公開範圍、照護注意事項（過敏等，需家長同意）、課程訊息同意。
-- 在 Supabase → SQL Editor 貼上整份執行（只需執行一次）。不會刪除既有資料。

begin;

-- ========== 1. 學生：照片公開範圍、照護注意事項 ==========
alter table students
  add column photo_scope text not null default 'none'
    check (photo_scope in ('none', 'works', 'all')),     -- none 不公開／works 只公開作品／all 作品與上課照片
  add column care_notes text,                             -- 照護注意事項（過敏、特殊需求），個資法第 6 條特種資料
  add column care_consent_at timestamptz,                 -- 家長同意記錄照護注意事項的時間
  add constraint care_notes_need_consent check (care_notes is null or care_consent_at is not null);

-- 既有資料：原本勾了照片同意的，視為作品與照片都可公開
update students set photo_scope = 'all' where photo_consent and photo_scope = 'none';

-- 家長：是否同意接收課程與活動訊息（特定目的 040 行銷）
alter table guardians
  add column marketing_consent boolean not null default false,
  add column marketing_consent_at timestamptz;

-- ========== 2. 線上報名申請（待審核） ==========
create table registration_requests (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),

  -- 孩子
  child_name text not null,
  child_nickname text not null,
  child_level level_code not null,
  child_birth_year int,
  child_gender text,
  child_school text,
  interests major_code[] not null default '{}',

  -- 主要聯絡人
  guardian_name text not null,
  guardian_relation text,
  guardian_phone text not null,
  guardian_email text,

  -- 其他可接送的人（選填）
  pickup_name text,
  pickup_relation text,
  pickup_phone text,

  -- 同意事項
  consent_version text not null,
  consent_at timestamptz not null,
  photo_scope text not null default 'none' check (photo_scope in ('none', 'works', 'all')),
  marketing_consent boolean not null default false,
  care_notes text,
  care_consent boolean not null default false,
  check (care_notes is null or care_consent),

  message text,                                     -- 家長留言
  review_note text,                                 -- 老師審核備註
  reviewed_by uuid references teachers (id) on delete set null,
  reviewed_at timestamptz,
  student_id uuid references students (id) on delete set null,  -- 審核通過後建立的學生
  created_at timestamptz not null default now()
);
create index on registration_requests (status, created_at desc);

alter table registration_requests enable row level security;
-- 不開放任何前端讀寫：官網表單與後台都透過伺服器端寫入。

commit;

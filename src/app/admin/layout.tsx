import type { Metadata } from "next";
import { requireStaff } from "@/lib/staff";
import { sbFetch } from "@/lib/supabase";
import { logout } from "../login/actions";
import AdminNav, { type NavGroup } from "./AdminNav";
import PendingFeedback from "./PendingFeedback";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "後台", template: "%s｜玩學院後台" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  // 待審核的線上報名筆數（顯示在選單上）
  const pending = await sbFetch("registration_requests?status=eq.pending&select=id", {
    method: "HEAD",
    headers: { Prefer: "count=exact" },
  })
    .then((r) => Number(r.headers.get("content-range")?.split("/")[1] ?? 0))
    .catch(() => 0);
  // 指派給我、還沒完成的規劃待辦（0012 還沒執行時當 0）
  const myTasks = await sbFetch(`plan_tasks?assignee_id=eq.${staff.id}&done_at=is.null&select=id`, {
    method: "HEAD",
    headers: { Prefer: "count=exact" },
  })
    .then((r) => (r.ok ? Number(r.headers.get("content-range")?.split("/")[1] ?? 0) : 0))
    .catch(() => 0);
  // 官網新詢問（未處理）筆數，只有管理員看得到
  const newLeads = staff.is_admin
    ? await sbFetch("leads?status=eq.new&select=id", { method: "HEAD", headers: { Prefer: "count=exact" } })
        .then((r) => Number(r.headers.get("content-range")?.split("/")[1] ?? 0))
        .catch(() => 0)
    : 0;

  // 依用途分類：每天上課 → 學生與家長 → 課程 → 招生與官網 → 系統設定
  const groups: NavGroup[] = [
    {
      title: "每天上課",
      items: [
        { href: "/admin", label: "今日課程", icon: "📅" },
        { href: "/admin/timesheet", label: "打卡紀錄", icon: "⏱️" },
      ],
    },
    {
      title: "學生與家長",
      items: [
        { href: "/admin/students", label: "學生名冊", icon: "🧒" },
        { href: "/admin/registrations", label: "報名審核", icon: "📝", badge: pending },
        { href: "/admin/cards", label: "學生卡片", icon: "💳" },
      ],
    },
    {
      title: "課程",
      items: [
        { href: "/admin/lessons", label: "教案庫", icon: "📚" },
        { href: "/admin/plans", label: "課程規劃", icon: "🗓️", badge: myTasks },
        { href: "/admin/classes", label: "開班與排課", icon: "🏫" },
      ],
    },
    ...(staff.is_admin
      ? [
          {
            title: "招生與官網",
            items: [
              { href: "/admin/leads", label: "官網詢問", icon: "💬", badge: newLeads },
              { href: "/admin/photos", label: "官網照片", icon: "🖼️" },
              { href: "/admin/activities", label: "活動與工作坊", icon: "🎪" },
            ],
          },
          {
            title: "系統設定",
            items: [
              { href: "/admin/teachers", label: "老師帳號", icon: "👩‍🏫" },
              { href: "/admin/devices", label: "讀卡站", icon: "📟" },
              { href: "/admin/lesson-settings", label: "課程分類與標籤", icon: "🏷️" },
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="adm adm-shell">
      <AdminNav
        groups={groups}
        me={staff.nickname ?? staff.name}
        logout={
          <form action={logout}>
            <button type="submit" className="adm-menu-link">
              <span className="adm-ico" aria-hidden="true">🚪</span>
              <span className="adm-label">登出</span>
            </button>
          </form>
        }
      />
      <main id="main" className="adm-main">{children}</main>
      <PendingFeedback />
    </div>
  );
}

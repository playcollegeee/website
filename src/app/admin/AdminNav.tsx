"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type NavItem = { href: string; label: string; icon: string; badge?: number };
export type NavGroup = { title: string; items: NavItem[] };

// 後台外框：桌機左側分類選單；手機上方一條列，按「選單」展開
export default function AdminNav({
  groups,
  me,
  logout,
}: {
  groups: NavGroup[];
  me: string;
  logout: React.ReactNode;
}) {
  const path = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const isOn = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  const current = groups.flatMap((g) => g.items).find((i) => isOn(i.href));
  const totalBadge = groups.flatMap((g) => g.items).reduce((n, i) => n + (i.badge ?? 0), 0);

  // 換頁後自動收起手機選單
  useEffect(() => setOpen(false), [path]);

  return (
    <aside className={`adm-side ${open ? "open" : ""}`}>
      <div className="adm-side-top">
        <Link href="/admin" className="adm-brand">
          <img src="/brand/logo-icon.png" alt="" width={30} height={30} />
          <span>玩學院後台</span>
        </Link>
        <span className="adm-side-current" aria-hidden="true">{current?.label}</span>
        <button
          type="button"
          className="adm-menu-btn"
          aria-expanded={open}
          aria-controls="adm-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕ 關閉" : "☰ 選單"}
          {!open && totalBadge > 0 && <span className="badge">{totalBadge}</span>}
        </button>
      </div>

      <nav id="adm-menu" className="adm-menu" aria-label="後台選單">
        {groups.map((g) => (
          <div key={g.title} className="adm-group">
            <p className="adm-group-title">{g.title}</p>
            {g.items.map((i) => {
              const on = isOn(i.href);
              return (
                <Link key={i.href} href={i.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
                  <span className="adm-ico" aria-hidden="true">{i.icon}</span>
                  <span className="adm-label">{i.label}</span>
                  {!!i.badge && <span className="badge" aria-label={`${i.badge} 筆待處理`}>{i.badge}</span>}
                </Link>
              );
            })}
          </div>
        ))}

        <div className="adm-group adm-me">
          <Link href="/admin/account" className={isOn("/admin/account") ? "on" : ""}>
            <span className="adm-ico" aria-hidden="true">👤</span>
            <span className="adm-label">{me}</span>
          </Link>
          <a href="/" target="_blank" rel="noopener">
            <span className="adm-ico" aria-hidden="true">🌐</span>
            <span className="adm-label">看官網 ↗</span>
          </a>
          {logout}
        </div>
      </nav>
    </aside>
  );
}

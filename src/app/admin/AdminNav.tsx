"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNav({ links }: { links: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname() ?? "";
  return (
    <nav className="adm-nav" aria-label="後台選單">
      {links.map((l) => {
        const on = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            {l.label}
            {!!l.badge && <span className="badge">{l.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

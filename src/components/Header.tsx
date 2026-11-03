import Link from "next/link";
import Image from "next/image";

const links = [
  { href: "/courses", label: "課程介紹" },
  { href: "/workshops", label: "活動與工作坊" },
  { href: "/schools", label: "學校合作" },
  { href: "/about", label: "關於玩學院" },
];

export default function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="玩學院首頁">
          <Image src="/brand/logo-horizontal.png" alt="玩學院" width={720} height={270} priority />
        </Link>
        <nav className="nav" aria-label="主選單">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
          <Link href="/contact" className="cta">
            預約試聽
          </Link>
        </nav>
      </div>
    </header>
  );
}

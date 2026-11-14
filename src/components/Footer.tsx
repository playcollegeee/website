import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/content";

export default function Footer({ trial = false }: { trial?: boolean }) {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <Image src="/brand/logo-horizontal.png" alt="玩學院" width={720} height={270} />
          <p className="footer-slogan">{site.taglineShort}</p>
          <p style={{ margin: "4px 0 0" }}>
            {site.name} {site.nameEn}｜{site.city}
          </p>
        </div>
        <div>
          <p style={{ margin: 0 }}>
            聯絡信箱：<a href={`mailto:${site.email}`}>{site.email}</a>
          </p>
          <p style={{ margin: 0 }}>
            <Link href="/contact">{trial ? "預約試聽與課程諮詢" : "課程諮詢與聯絡我們"}</Link>
          </p>
          <p style={{ margin: 0 }}>
            <Link href="/enroll">新生線上報名</Link>
          </p>
          <p className="social" style={{ margin: "8px 0 0" }}>
            {site.facebook && (
              <a href={site.facebook} target="_blank" rel="noopener noreferrer">
                Facebook
              </a>
            )}
            {site.instagram && (
              <a href={site.instagram} target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
            )}
            {site.line && (
              <a href={site.line} target="_blank" rel="noopener noreferrer">
                LINE
              </a>
            )}
          </p>
        </div>
        <div>
          <div className="blocks" aria-hidden="true">
            <span style={{ background: "var(--red)" }} />
            <span style={{ background: "var(--green)" }} />
            <span style={{ background: "var(--yellow)" }} />
            <span style={{ background: "var(--blue)" }} />
          </div>
          <p style={{ margin: "8px 0 0" }}>© {year} 至聖文教事業有限公司</p>
          <p style={{ margin: 0 }}>
            <Link href="/privacy">隱私權政策</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

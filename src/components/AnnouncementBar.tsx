import Link from "next/link";
import { announcement } from "@/lib/content";

export default function AnnouncementBar() {
  if (!announcement.text) return null;
  return (
    <div className="announce">
      <div className="container announce-inner">
        <span>{announcement.text}</span>
        <Link href={announcement.href}>{announcement.cta} →</Link>
      </div>
    </div>
  );
}

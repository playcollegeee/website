import type { Metadata } from "next";
import Link from "next/link";
import { schoolServices } from "@/lib/content";

export const metadata: Metadata = {
  title: "學校與機構合作",
  description: "玩學院提供入校 STEAM 課程、社團營隊、親子館活動與客製化專案合作。",
};

export default function SchoolsPage() {
  return (
    <>
      <section>
        <div className="container">
          <p className="eyebrow">學校與機構合作</p>
          <h1>把動手做的課帶進校園</h1>
          <p className="lead">
            從幼兒積木到機器人專題，玩學院提供完整的教案、教材與師資，並依學校的年段、課表與設備調整內容。
          </p>
        </div>
      </section>
      <section className="bg-green">
        <div className="container grid cols-2">
          {schoolServices.map((s, i) => (
            <div key={s.title} className={`card bar-${["yellow", "red", "blue", "green"][i % 4]}`}>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="container">
          <h2>洽詢合作</h2>
          <p className="lead">請留下學校或機構名稱、聯絡人與想合作的形式，我們會盡快回覆。</p>
          <div className="btn-row">
            <Link href="/contact?type=school" className="btn primary">
              填寫合作洽詢
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

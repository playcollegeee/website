import type { Metadata } from "next";
import TrialForm from "@/components/TrialForm";
import { site } from "@/lib/content";

export const metadata: Metadata = {
  title: "預約試聽與聯絡我們",
  description: "預約玩學院試聽課程、詢問活動與工作坊，或洽詢學校與機構合作。",
};

const allowed = ["trial", "workshop", "school", "other"];

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ type?: string; level?: string; major?: string }> }) {
  const { type, level, major } = await searchParams;
  const defaultType = type && allowed.includes(type) ? type : "trial";
  const defaultLevel = level && /^[a-z]{4,12}$/.test(level) ? level : "";
  const defaultMajors = major && ["lego", "3d", "art"].includes(major) ? [major] : [];
  return (
    <section>
      <div className="container grid cols-2" style={{ alignItems: "start" }}>
        <div>
          <p className="eyebrow">預約試聽與聯絡我們</p>
          <h1>帶孩子來玩一次吧</h1>
          <p className="lead">填寫表單後，我們會依孩子的年級與興趣，推薦合適的試聽課程與時段。</p>
          <p>已經決定要上課了？<a href="/enroll">直接線上報名 →</a></p>
          <div className="card bar-yellow" style={{ marginTop: 24 }}>
            <h3>其他聯絡方式</h3>
            <p>
              Email：<a href={`mailto:${site.email}`}>{site.email}</a>
            </p>
            <p>
              <a href={site.facebook} target="_blank" rel="noopener noreferrer">Facebook 粉絲專頁</a>
              {"・"}
              <a href={site.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
            </p>
            {site.line && (
              <p>
                LINE 官方帳號：<a href={site.line}>加入好友</a>
              </p>
            )}
          </div>
        </div>
        <div className="card">
          <TrialForm defaultType={defaultType} defaultLevel={defaultLevel} defaultMajors={defaultMajors} />
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { FLAG_INFO, HERO_CARDS_MAX, HERO_CARDS_MIN, getHeroCardCount, getSiteFlags } from "@/lib/siteFlags";
import { getPublishedActivities } from "@/lib/activities";
import { Quests, Ribbon } from "@/components/HomeExtras";
import FlagSwitch from "./FlagSwitch";
import HeroCount from "./HeroCount";
import { NewsEditor, NoticeEditor } from "./NoticeEditor";
import { getNoticeSettings, getOpenRunSummaries } from "@/lib/siteNotice";
import { announcement } from "@/lib/content";

export const metadata = { title: "官網區塊開關" };

// 後台：官網區塊開關＋被隱藏區塊的預覽（管理員）
export default async function SiteSectionsPage() {
  await requireStaff(true);
  const [flags, heroCards, activities, { notice, news }, runs] = await Promise.all([
    getSiteFlags(),
    getHeroCardCount(),
    getPublishedActivities(),
    getNoticeSettings(),
    getOpenRunSummaries(),
  ]);
  const withPhoto = activities.filter((a) => a.image_url).length;
  return (
    <>
      <div className="adm-head">
        <h1>官網區塊開關</h1>
        <div className="adm-actions">
          <Link className="btn btn-sm" href="/" target="_blank">看官網首頁 ↗</Link>
        </div>
      </div>
      <p className="hint">先拿掉、之後可能再用的區塊都放在這裡。按一下就能在官網顯示或隱藏，下方可以預覽它們的樣子。</p>

      <div className="flag-list">
        <div className="adm-panel">
          <h2>頂部公告列</h2>
          <p className="hint">每一頁最上面那條黑色通知。</p>
          <NoticeEditor initial={notice} runs={runs} fallback={announcement.text} />
        </div>
        <div className="adm-panel">
          <h2>右下角最新消息小卡</h2>
          <p className="hint">每一頁右下角的小卡，放報名中的活動（照片、日期、立即報名）。家長按 ✕ 關掉後，同一場不會再出現；有新的一場報名時會再出現。</p>
          <NewsEditor initial={news} runs={runs} />
        </div>
        <div className="adm-panel flag-row">
          <div>
            <h2>首屏飄浮小卡數量</h2>
            <p className="hint">
              首頁最上面同時飄著幾張活動小卡（{HERO_CARDS_MIN}～{HERO_CARDS_MAX} 張）。目前有照片的活動卡片有 {withPhoto} 個；
              數量比活動多時，同一個活動會重複出現。活動變多之後再把數量調高。
            </p>
          </div>
          <HeroCount count={heroCards} />
        </div>
        {FLAG_INFO.map((f) => (
          <div key={f.key} className="adm-panel flag-row">
            <div>
              <h2>{f.label}</h2>
              <p className="hint">{f.note}</p>
            </div>
            <FlagSwitch k={f.key} on={flags[f.key]} />
          </div>
        ))}
      </div>

      <h2 className="ph-h">預覽：標語跑馬燈</h2>
      <div className="flag-preview">
        <Ribbon tone="yellow" />
      </div>
      <h2 className="ph-h">預覽：選擇任務</h2>
      <div className="flag-preview">
        <Quests />
      </div>
      <h2 className="ph-h">預覽：預約試聽</h2>
      <p className="hint">打開後：頁首右上角與右下角浮動按鈕會出現「預約試聽」，首頁首屏、課程介紹、關於頁、快速找課程、角色試玩的按鈕會換回「預約試聽」，詢問表單多一個「預約試聽」選項。</p>
    </>
  );
}

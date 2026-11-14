import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { FLAG_INFO, getSiteFlags } from "@/lib/siteFlags";
import { Quests, Ribbon } from "@/components/HomeExtras";
import FlagSwitch from "./FlagSwitch";

export const metadata = { title: "官網區塊開關" };

// 後台：官網區塊開關＋被隱藏區塊的預覽（管理員）
export default async function SiteSectionsPage() {
  await requireStaff(true);
  const flags = await getSiteFlags();
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

import type { Metadata } from "next";
import Link from "next/link";
import TrialCta from "@/components/TrialCta";
import { site } from "@/lib/content";

export const metadata: Metadata = {
  title: "隱私權政策",
  description: `${site.name}如何蒐集、使用與保護您在官網留下的個人資料。`,
};

// 依《個人資料保護法》第 8 條應告知的六個事項撰寫。內容若有變動，記得更新「最後更新日期」。
const updated = "2026 年 11 月 4 日";

export default function PrivacyPage() {
  return (
    <section>
      <div className="container prose">
        <p className="eyebrow">隱私權政策</p>
        <h1>我們如何保護您的資料</h1>
        <p className="lead">
          {site.name} {site.nameEn} 重視每一位家長與孩子的隱私。以下說明您在本網站填寫表單時，我們蒐集哪些資料、用在哪裡，以及您可以怎麼管理這些資料。
        </p>

        <h2>一、蒐集者</h2>
        <p>
          至聖文教事業有限公司（品牌：{site.name} {site.nameEn}，以下稱「我們」）。
        </p>

        <h2>二、蒐集的目的</h2>
        <ul>
          <li>回覆您的詢問，聯絡、安排試聽、活動或學校合作。</li>
          <li>提供您有興趣的課程與活動資訊。</li>
          <li>內部統計與改善服務（不會辨識出個人）。</li>
        </ul>

        <h2>三、蒐集的資料類別</h2>
        <ul>
          <li>家長或聯絡人：姓名、電話、Email（選填）。</li>
          <li>孩子：年級階段與有興趣的主修。我們不會在表單要求孩子的姓名、生日或照片。</li>
          <li>您在留言欄自行填寫的內容。</li>
        </ul>

        <h2>四、資料利用的期間、地區、對象及方式</h2>
        <ul>
          <li>
            <strong>期間：</strong>上述目的存續期間；您要求刪除，或我們不再需要時，就會刪除。
          </li>
          <li>
            <strong>地區：</strong>資料存放在我們使用的雲端服務（資料庫 Supabase、網站主機 Vercel），伺服器可能位於臺灣以外的地區。這些服務都有加密傳輸與存取控管。
          </li>
          <li>
            <strong>對象：</strong>只有{site.name}的負責人與授課老師可以查看。除法律要求外，不會提供、出售或出租給任何第三方。
          </li>
          <li>
            <strong>方式：</strong>以電話、簡訊、Email 或通訊軟體與您聯絡；資料以電子方式保存，後台需要密碼才能進入。
          </li>
        </ul>

        <h2>五、您的權利</h2>
        <p>依《個人資料保護法》第 3 條，您可以隨時：</p>
        <ul>
          <li>查詢或請求閱覽您的資料，或請求製給複製本。</li>
          <li>請求補充或更正。</li>
          <li>請求停止蒐集、處理或利用。</li>
          <li>請求刪除。</li>
        </ul>
        <p>
          請來信 <a href={`mailto:${site.email}`}>{site.email}</a>，我們確認身分後會盡快處理。
        </p>

        <h2>六、不提供資料的影響</h2>
        <p>
          您可以自由選擇是否提供資料。若不提供姓名與電話，我們將無法聯絡您或安排試聽；Email 與留言為選填，不填不影響預約。
        </p>

        <h2>七、孩子的照片與作品</h2>
        <p>
          報名時我們會說明：課堂照片與學生作品預設會分享在官網與社群，家長可在報名表選擇「只公開作品」或「都不公開」，之後也可隨時告訴我們撤回，我們會在 7 日內移除自己管理的官網與社群內容。公開時只使用孩子的角色暱稱，不會顯示本名。
        </p>

        <h2>八、Cookie</h2>
        <p>
          本網站不使用廣告或追蹤用 Cookie。我們使用 Vercel Web Analytics 統計各頁面的瀏覽次數，用來改善網站；這項服務不使用
          Cookie，也不會辨識或追蹤個別訪客。
        </p>

        <h2>九、政策更新</h2>
        <p>本政策如有修改，會公告在這個頁面。最後更新日期：{updated}。</p>

        <div className="btn-row">
          <TrialCta />
          <a href={`mailto:${site.email}`} className="btn">
            來信詢問
          </a>
        </div>
      </div>
    </section>
  );
}

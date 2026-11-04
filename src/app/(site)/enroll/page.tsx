import type { Metadata } from "next";
import EnrollForm from "@/components/EnrollForm";

export const metadata: Metadata = {
  title: "新生報名",
  description: "玩學院 Play Collegeee 線上新生報名：填寫孩子與家長資料，老師確認後與您聯絡。",
};

export default function EnrollPage() {
  return (
    <section>
      <div className="container enroll">
        <p className="eyebrow">新生報名</p>
        <h1>歡迎加入玩學院</h1>
        <p className="lead">
          填好資料後，老師會確認班級與時段，再與您聯絡。大約 3 分鐘可以填完。還在考慮的話，也可以先
          <a href="/contact?type=trial">預約試聽</a>。
        </p>
        <div className="card">
          <EnrollForm />
        </div>
      </div>
    </section>
  );
}

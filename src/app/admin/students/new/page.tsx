import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { createStudent } from "../actions";
import StudentFields from "../StudentFields";
import GuardianFields from "../GuardianFields";

export const metadata = { title: "新增學生" };

export default async function NewStudentPage() {
  await requireStaff();
  return (
    <>
      <div className="adm-head">
        <h1>新增學生</h1>
        <Link href="/admin/students" className="adm-link">← 回學生列表</Link>
      </div>
      <form action={createStudent} className="adm-form">
        <fieldset className="adm-panel">
          <legend>孩子</legend>
          <StudentFields />
        </fieldset>
        <fieldset className="adm-panel">
          <legend>主要聯絡人</legend>
          <GuardianFields />
        </fieldset>
        <fieldset className="adm-panel">
          <legend>家長同意</legend>
          <label className="adm-check">
            <input type="checkbox" name="consent" required /> 家長已簽署「個人資料蒐集同意書」*
          </label>
          <div className="adm-radio">
            方式：
            <label><input type="radio" name="consent_method" value="paper" defaultChecked /> 紙本</label>
            <label><input type="radio" name="consent_method" value="online" /> 線上</label>
          </div>
          <label className="adm-check">
            <input type="checkbox" name="photo_consent" /> 家長同意孩子的照片、作品公開在官網與社群
          </label>
          <p className="hint">沒有簽同意書的孩子不能建檔。照片公開可以之後再補勾。</p>
        </fieldset>
        <button type="submit" className="btn primary">建立學生</button>
      </form>
    </>
  );
}

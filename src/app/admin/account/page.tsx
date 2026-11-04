import { requireStaff } from "@/lib/staff";
import PasswordForm from "./PasswordForm";

export const metadata = { title: "我的帳號" };

export default async function AccountPage() {
  const staff = await requireStaff();
  return (
    <>
      <div className="adm-head"><h1>{staff.nickname ?? staff.name} <small>{staff.email}{staff.is_admin && "・管理員"}</small></h1></div>
      <PasswordForm />
    </>
  );
}

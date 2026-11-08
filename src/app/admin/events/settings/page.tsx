import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { getSettings, TEMPLATE_KEYS, TEMPLATE_VARS } from "@/lib/events";
import { saveSettings } from "../actions";
import SettingsForm from "./SettingsForm";

export const metadata = { title: "活動報名設定" };

export default async function EventSettingsPage() {
  await requireStaff(true);
  const s = await getSettings();
  return (
    <>
      <p className="hint"><Link href="/admin/events">← 活動報名</Link></p>
      <h1>活動報名設定</h1>
      <SettingsForm values={s} templates={TEMPLATE_KEYS} vars={TEMPLATE_VARS} save={saveSettings} />
    </>
  );
}

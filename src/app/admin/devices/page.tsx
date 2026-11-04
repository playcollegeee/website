import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/admin";
import { setDeviceActive, updateDeviceRoom } from "./actions";
import NewDeviceForm from "./NewDeviceForm";

export const metadata = { title: "讀卡站" };

type D = { id: string; name: string; room: string | null; active: boolean; last_seen_at: string | null; created_at: string };

export default async function DevicesPage() {
  await requireStaff(true);
  const devices = await sbGet<D[]>("devices?order=active.desc,created_at&select=id,name,room,active,last_seen_at,created_at");
  return (
    <>
      <div className="adm-head">
        <h1>讀卡站</h1>
        <div className="adm-actions"><Link className="btn btn-sm" href="/kiosk">開啟讀卡站畫面</Link></div>
      </div>
      <div className="adm-panel">
        <h2>怎麼設定教室平板</h2>
        <ol className="adm-steps">
          <li>在教室的平板（或舊筆電）用瀏覽器登入這個後台。</li>
          <li>在下方「新增讀卡站」填名稱，按「在這台裝置啟用」。</li>
          <li>把 USB 讀卡機插上平板，打開 <Link href="/kiosk">讀卡站畫面</Link>，刷卡測試。Android 手機可以直接用內建 NFC。</li>
          <li>回後台按「登出」，讀卡站會繼續運作。建議把讀卡站畫面「加到主畫面」，全螢幕顯示。</li>
        </ol>
      </div>

      {devices.length > 0 && (
        <section className="adm-panel">
          <h2>已建立的讀卡站</h2>
          <ul className="adm-rows">
            {devices.map((d) => (
              <li key={d.id} className={d.active ? "" : "muted"}>
                <form action={updateDeviceRoom} className="adm-inline-form">
                  <input type="hidden" name="id" value={d.id} />
                  <input name="name" defaultValue={d.name} aria-label="名稱" required />
                  <input name="room" defaultValue={d.room ?? ""} placeholder="教室" aria-label="教室" size={6} />
                  <button className="adm-link" type="submit">儲存</button>
                </form>
                <small>{d.last_seen_at ? `最近刷卡 ${fmtDateTime(d.last_seen_at)}` : "還沒刷過卡"}</small>
                <form action={setDeviceActive}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="active" value={d.active ? "0" : "1"} />
                  <button className={`adm-link ${d.active ? "danger" : ""}`} type="submit">{d.active ? "停用" : "重新啟用"}</button>
                </form>
              </li>
            ))}
          </ul>
          <p className="hint">平板遺失或金鑰外流時按「停用」，那台裝置就無法再送出簽到。</p>
        </section>
      )}
      <NewDeviceForm />
    </>
  );
}

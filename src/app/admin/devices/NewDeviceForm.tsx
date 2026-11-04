"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createDevice, type DeviceState } from "./actions";

export default function NewDeviceForm() {
  const [state, action, pending] = useActionState(createDevice, {} as DeviceState);
  return (
    <form action={action} className="adm-panel adm-form">
      <h2>新增讀卡站</h2>
      <div className="adm-grid">
        <div className="field"><label htmlFor="d-name">名稱 *</label><input id="d-name" name="name" required maxLength={40} placeholder="例：櫃台平板" /></div>
        <div className="field">
          <label htmlFor="d-room">放在哪間教室</label>
          <input id="d-room" name="room" maxLength={20} placeholder="例：A（和班級設定的教室一致）" />
        </div>
      </div>
      <div className="adm-btns">
        <button className="btn primary" type="submit" name="mode" value="here" disabled={pending}>在這台裝置啟用（平板／電腦）</button>
        <button className="btn" type="submit" name="mode" value="key" disabled={pending}>產生金鑰（ESP32／Raspberry Pi 用）</button>
      </div>
      {state.error && <p className="notice err" role="alert">{state.error}</p>}
      {state.enabledHere && (
        <div className="notice ok" role="status">
          這台裝置已設為「{state.name}」讀卡站。<Link href="/kiosk">開啟讀卡站畫面 →</Link>
          <br />平板設定好之後，記得在後台按右上角「登出」，讀卡站仍會保持啟用。
        </div>
      )}
      {state.key && (
        <div className="notice ok" role="status">
          「{state.name}」的金鑰（只會顯示這一次，請複製到 ESP32 程式裡）：
          <pre className="adm-key">{state.key}</pre>
          呼叫方式：POST https://playcollegeee.com/api/checkin，標頭 Authorization: Bearer 金鑰，內容 {"{\"uid\":\"卡號\"}"}
        </div>
      )}
    </form>
  );
}

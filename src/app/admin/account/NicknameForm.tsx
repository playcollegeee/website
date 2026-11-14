"use client";

import { useActionState } from "react";
import { changeNickname } from "./actions";

// 我的稱呼：例「阿智老師」，讀卡站、後台與會議都會顯示
export default function NicknameForm({ current, name }: { current: string | null; name: string }) {
  const [state, action, pending] = useActionState(changeNickname, {} as { ok?: string; error?: string });
  return (
    <form action={action} className="adm-panel adm-form adm-narrow" style={{ marginBottom: 20 }}>
      <h2>我的稱呼</h2>
      <p className="hint">讀卡站刷卡、後台、會議與點子牆都會顯示這個名字。真實姓名（{name}）如需修改請找管理員。</p>
      <div className="field"><label htmlFor="nickname">稱呼</label><input id="nickname" name="nickname" defaultValue={current ?? ""} placeholder="例：阿智老師" maxLength={20} required /></div>
      {state.error && <p className="notice err" role="alert">{state.error}</p>}
      {state.ok && <p className="notice ok" role="status">{state.ok}</p>}
      <div className="btn-row">
        <button type="submit" className="btn primary btn-sm" disabled={pending}>{pending ? "儲存中…" : "儲存稱呼"}</button>
      </div>
    </form>
  );
}

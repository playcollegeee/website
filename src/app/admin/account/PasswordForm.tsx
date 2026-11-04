"use client";

import { useActionState } from "react";
import { changePassword } from "./actions";

export default function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, {} as { ok?: string; error?: string });
  return (
    <form action={action} className="adm-panel adm-form adm-narrow">
      <h2>修改密碼</h2>
      <div className="field"><label htmlFor="current">目前的密碼</label><input id="current" name="current" type="password" required autoComplete="current-password" /></div>
      <div className="field"><label htmlFor="next">新密碼（至少 10 個字元）</label><input id="next" name="next" type="password" required minLength={10} autoComplete="new-password" /></div>
      <div className="field"><label htmlFor="confirm">再輸入一次</label><input id="confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" /></div>
      {state.error && <p className="notice err" role="alert">{state.error}</p>}
      {state.ok && <p className="notice ok" role="status">{state.ok}</p>}
      <button className="btn primary" type="submit" disabled={pending}>更新密碼</button>
    </form>
  );
}

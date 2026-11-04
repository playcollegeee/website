"use client";

import { useActionState } from "react";
import { createTeacher, type TeacherFormState } from "./actions";

export default function NewTeacherForm() {
  const [state, action, pending] = useActionState(createTeacher, {} as TeacherFormState);
  return (
    <form action={action} className="adm-panel adm-form">
      <h2>新增老師</h2>
      <div className="adm-grid">
        <div className="field"><label htmlFor="t-name">姓名 *</label><input id="t-name" name="name" required maxLength={40} /></div>
        <div className="field"><label htmlFor="t-nick">稱呼</label><input id="t-nick" name="nickname" maxLength={20} placeholder="例：小美老師" /></div>
        <div className="field"><label htmlFor="t-email">登入 Email *</label><input id="t-email" name="email" type="email" required /></div>
        <div className="field"><label htmlFor="t-phone">手機</label><input id="t-phone" name="phone" type="tel" /></div>
        <div className="field">
          <label htmlFor="t-pw">臨時密碼 *</label>
          <input id="t-pw" name="password" required minLength={10} autoComplete="new-password" />
          <small>至少 10 個字元，老師第一次登入後自己改</small>
        </div>
        <label className="adm-check"><input type="checkbox" name="is_admin" /> 管理員（可看詢問、管理老師與讀卡站）</label>
      </div>
      {state.error && <p className="notice err" role="alert">{state.error}</p>}
      {state.ok && <p className="notice ok" role="status">{state.ok}</p>}
      <button className="btn primary" type="submit" disabled={pending}>{pending ? "建立中…" : "建立老師帳號"}</button>
    </form>
  );
}

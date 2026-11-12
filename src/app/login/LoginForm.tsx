"use client";

import { useActionState, useEffect, useState } from "react";
import { login, type LoginState } from "./actions";

// 登入表單：欄位編號＋底線輸入框（版面參考 @Lattice_Node 的 Sign-in Set，ludion.ai/p/auth-set，MIT；程式為自行撰寫）
export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, { error: "", email: "" } as LoginState);
  const [show, setShow] = useState(false);

  // 通知背景的積木光圈：登入中先收起來一點
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("pc-gate", { detail: pending }));
  }, [pending]);

  return (
    <form action={action} className="login-form">
      <input type="hidden" name="next" value={next} />
      <div className="lg-field">
        <label htmlFor="email">
          <span className="lg-n">01</span> Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} key={state.email} placeholder="teacher@example.com" />
      </div>
      <div className="lg-field">
        <label htmlFor="password">
          <span className="lg-n">02</span> 密碼
        </label>
        <div className="lg-pw">
          <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required />
          <button type="button" className="lg-show" onClick={() => setShow(!show)} aria-pressed={show} aria-controls="password">
            {show ? "隱藏" : "顯示"}
          </button>
        </div>
      </div>
      {state.error && (
        <p className="notice err" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="lg-submit" disabled={pending}>
        {pending ? "開門中…" : "進入後台 →"}
      </button>
      <p className="lg-help">忘記密碼請找管理員重設。</p>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, { error: "", email: "" } as LoginState);
  return (
    <form action={action} className="login-form">
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} key={state.email} />
      </div>
      <div className="field">
        <label htmlFor="password">密碼</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && <p className="notice err" role="alert">{state.error}</p>}
      <button type="submit" className="btn primary" disabled={pending}>
        {pending ? "登入中…" : "登入"}
      </button>
    </form>
  );
}

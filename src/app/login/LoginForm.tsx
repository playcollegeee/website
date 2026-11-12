"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { login, type LoginState } from "./actions";

// 登入表單：欄位編號＋底線輸入框（版面參考 @Lattice_Node 的 Sign-in Set，ludion.ai/p/auth-set，MIT；程式為自行撰寫）
// 登入成功後播「學院圖示打開」：LOGO 組起來 → 屋頂往上掀、柱子往兩邊滑開、底座往下 → 進入後台
export default function LoginForm({ next, signedIn }: { next: string; signedIn: boolean }) {
  const [state, action, pending] = useActionState(login, { error: "", email: "" } as LoginState);
  const [show, setShow] = useState(false);
  const [door, setDoor] = useState<"" | "closed" | "open">("");
  const router = useRouter();

  useEffect(() => {
    router.prefetch(next);
  }, [router, next]);

  const started = useRef(false);
  const goTo = state.to ?? (signedIn ? next : "");
  useEffect(() => {
    if (!goTo || started.current) return;
    started.current = true;
    const to = goTo;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      router.replace(to);
      return;
    }
    setDoor("closed");
    const t1 = setTimeout(() => setDoor("open"), 650);
    const t2 = setTimeout(() => router.replace(to), 1700);
    // 不清除計時器：登入後頁面會重新整理一次，動畫要繼續跑完
    void t1;
    void t2;
  }, [goTo, router]);

  return (
    <>
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
        <button type="submit" className="lg-submit" disabled={pending || !!goTo}>
          {goTo ? "歡迎回來！" : pending ? "確認中…" : "進入後台 →"}
        </button>
        <p className="lg-help">忘記密碼請找管理員重設。</p>
      </form>

      {/* 放到 body 底下：卡片有毛玻璃與動畫，fixed 會被限制在卡片裡 */}
      {door &&
        createPortal(
        <div className={`lg-door ${door}`} role="status" aria-live="polite">
          <span className="sr-only">登入成功，正在進入後台</span>
          <div className="lg-door-light" />
          <div className="lg-icon" aria-hidden="true">
            {/* 原始 LOGO 切出來的零件，依原圖位置疊回去 */}
            {["roof", "p1", "p2", "cap", "box", "base"].map((k) => (
              <img key={k} src={`/brand/parts/${k}.png`} alt="" className={`d-${k}`} />
            ))}
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}

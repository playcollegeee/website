"use client";

import { useEffect } from "react";

// 後台所有表單：按下送出的那顆按鈕立刻顯示「處理中」，畫面頂端出現進度條。
// 伺服器回應、畫面更新後自動恢復（最多 15 秒保險）。
export default function PendingFeedback() {
  useEffect(() => {
    const main = document.getElementById("main");
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clear = () => {
      document.documentElement.classList.remove("adm-busy");
      document.querySelectorAll("[data-pending]").forEach((el) => el.removeAttribute("data-pending"));
      if (timer) clearTimeout(timer);
    };

    const onSubmit = (e: SubmitEvent) => {
      const btn = e.submitter as HTMLElement | null;
      btn?.setAttribute("data-pending", "");
      (e.target as HTMLElement).setAttribute("data-pending", "");
      document.documentElement.classList.add("adm-busy");
      if (timer) clearTimeout(timer);
      timer = setTimeout(clear, 15000);
    };

    // 畫面內容一有變動（伺服器回應後重新整理）就清掉
    const obs = new MutationObserver(() => {
      if (document.documentElement.classList.contains("adm-busy")) clear();
    });
    if (main) obs.observe(main, { childList: true, subtree: true, characterData: true });

    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      obs.disconnect();
      clear();
    };
  }, []);
  return null;
}

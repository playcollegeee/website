"use client";

import { useState } from "react";

// 一鍵複製文字（私訊稿、報名編號）
export default function CopyButton({ text, label = "複製", className = "btn btn-sm" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 舊瀏覽器：用隱藏的文字框複製
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }
  return (
    <button type="button" className={className} onClick={copy}>
      {done ? "已複製 ✓" : label}
    </button>
  );
}

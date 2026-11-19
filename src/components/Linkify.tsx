"use client";

import { Fragment } from "react";

// 文字裡的網址自動變成可以點的超連結（2026-11-19，規劃與會議室的所有文字）。
// 只認 http(s):// 與 www. 開頭；結尾的標點（，。、）」等）不算網址。另開分頁，不帶來源資訊。
// client 元件（連結要擋白板的拖動），伺服器頁面也可以直接放。
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'，。、；：！？「」『』（）【】《》]+/gi;
const TRAIL = /[.,;:!?)\]}'"…]+$/;

export function splitLinks(text: string): ({ t: string } | { url: string; label: string })[] {
  const out: ({ t: string } | { url: string; label: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let raw = m[0];
    const trail = raw.match(TRAIL)?.[0] ?? "";
    // 網址裡有成對的括號時保留右括號（例：維基百科網址）
    if (trail.startsWith(")") && raw.includes("(")) raw = raw.slice(0, raw.length - trail.length + 1);
    else if (trail) raw = raw.slice(0, -trail.length);
    if (!raw) continue;
    const at = m.index ?? 0;
    if (at > last) out.push({ t: text.slice(last, at) });
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    out.push({ url, label: raw.length > 60 ? `${raw.slice(0, 57)}…` : raw });
    last = at + raw.length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}

export default function Linkify({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  const parts = splitLinks(text);
  return (
    <>
      {parts.map((p, i) =>
        "url" in p ? (
          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="autolink"
            onPointerDown={(e) => e.stopPropagation()}>
            {p.label}
          </a>
        ) : (
          <Fragment key={i}>{p.t}</Fragment>
        ),
      )}
    </>
  );
}

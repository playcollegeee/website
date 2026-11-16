"use client";

import { useRef, useState } from "react";
import RichText, { RichList } from "@/components/RichText";

// 後台：可以換行、貼 emoji、加粗體的文字框，下方即時預覽官網上的樣子。
// list=true 是「課程特色」：每一點之間空一行，每點第一行是標題、第二行起是說明。
export default function RichTextarea({
  name,
  defaultValue,
  rows = 6,
  maxLength = 2000,
  placeholder,
  list = false,
}: {
  name: string;
  defaultValue: string;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  list?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue);

  // 把選取的文字加上（或拿掉）粗體記號；跨多行時一行一行加
  function bold() {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e);
    let next: string;
    if (!sel) next = "**粗體文字**";
    else if (/^\*\*[^\n]+\*\*$/.test(sel)) next = sel.slice(2, -2);
    else next = sel.split("\n").map((l) => (l.trim() ? `**${l.replaceAll("**", "")}**` : l)).join("\n");
    const out = value.slice(0, s) + next + value.slice(e);
    setValue(out.slice(0, maxLength));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s, s + next.length);
    });
  }

  const items = value.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  return (
    <div className="rt">
      <div className="rt-bar">
        <button type="button" className="btn btn-sm rt-b" onClick={bold} title="把選取的文字變粗體（Ctrl+B）">B 粗體</button>
        <span className="hint">
          {list ? "每一點之間空一行；每點第一行是標題，第二行起是說明。" : "直接換行就會換行。"}可以貼 emoji；選取文字後按「B 粗體」。
        </span>
      </div>
      <textarea
        ref={ref}
        name={name}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className="ev-full"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
            e.preventDefault();
            bold();
          }
        }}
      />
      {value.trim() && (
        <div className="rt-preview">
          <span className="rt-preview-label">官網顯示預覽</span>
          {list ? <RichList items={items} /> : <RichText text={value} />}
        </div>
      )}
    </div>
  );
}

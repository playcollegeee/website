import { Fragment } from "react";

// 簡易格式文字（和 Google 表單的說明欄類似）：保留換行、可貼 emoji、**粗體**。
// 不接受 HTML，所以後台貼什麼都不會有安全問題。伺服器與瀏覽器元件都能用。
export function richInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*\n]+?\*\*)/g).map((part, i) =>
    part.length > 4 && part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

export default function RichText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  return (
    <div className={`rich ${className}`.trim()}>
      {lines.map((line, i) => (line.trim() === "" ? <div key={i} className="rich-gap" aria-hidden="true" /> : <p key={i}>{richInline(line)}</p>))}
    </div>
  );
}

// 課程特色：每一點第一行是標題，其他行是說明
export function RichList({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <ul className={`rich-list ${className}`.trim()}>
      {items.map((item, i) => {
        const [head, ...rest] = item.replace(/\r\n?/g, "\n").split("\n");
        return (
          <li key={i}>
            <span className="rich-list-head">{richInline(head)}</span>
            {rest.filter((l) => l.trim()).map((l, j) => <span key={j} className="rich-list-body">{richInline(l)}</span>)}
          </li>
        );
      })}
    </ul>
  );
}

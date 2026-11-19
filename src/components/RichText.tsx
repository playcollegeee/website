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

// 課程流程圖：點圖片開新分頁看大圖
export function FlowImage({ url, width, height, title }: { url: string; width?: number | null; height?: number | null; title: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="su-flow" aria-label={`${title}課程流程圖，點一下看大圖`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`${title}課程流程圖`} width={width ?? 1131} height={height ?? 1600} loading="lazy" />
      <span className="su-flow-hint">點圖片看大圖</span>
    </a>
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

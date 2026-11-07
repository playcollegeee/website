import type { ReactNode } from "react";

/**
 * 照片跑馬燈（不需要瀏覽器 JavaScript，純 CSS 動畫）
 * - 內容放兩份，向左（reverse 時向右）慢慢移動，第二份接在後面，看起來無限循環
 * - 滑鼠移上去或用鍵盤聚焦時暫停，方便看清楚
 * - 使用者開啟「減少動態效果」時不動，改成可以左右滑動
 */
export default function PhotoMarquee({
  children,
  seconds,
  reverse = false,
  label,
}: {
  children: ReactNode;
  seconds: number; // 跑完一輪的秒數，越大越慢
  reverse?: boolean;
  label: string;
}) {
  return (
    <div
      className={`pm${reverse ? " reverse" : ""}`}
      style={{ "--pm-dur": `${seconds}s` } as React.CSSProperties}
      role="region"
      aria-label={label}
    >
      <div className="pm-track">
        <div className="pm-copy">{children}</div>
        {/* 第二份只是為了接續畫面，讀屏軟體與鍵盤都略過 */}
        <div className="pm-copy" aria-hidden="true" inert>
          {children}
        </div>
      </div>
    </div>
  );
}

/** 照片太少時重複補滿，避免一輪還沒跑完就露出空白 */
export function fillTo<T>(items: T[], min: number): T[] {
  if (items.length === 0) return items;
  const out: T[] = [];
  while (out.length < min) out.push(...items);
  return out;
}

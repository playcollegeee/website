// 後台換頁時先顯示的畫面，點下去馬上有反應
export default function Loading() {
  return (
    <div className="adm-loading" role="status" aria-live="polite">
      <span className="adm-loading-dot" />
      <span className="adm-loading-dot" />
      <span className="adm-loading-dot" />
      <span className="sr-only">載入中…</span>
    </div>
  );
}

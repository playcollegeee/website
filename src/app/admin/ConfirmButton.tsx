"use client";

import { useState } from "react";

// 頁面上直接確認的按鈕（取代瀏覽器的 confirm 視窗：Claude 內建瀏覽器等環境不會跳出確認視窗，按了等於取消）
// 第一次按：顯示說明與「確定／取消」；按「確定」才執行
export default function ConfirmButton({
  label, message, confirmLabel = "確定", onConfirm, className = "adm-link danger", disabled, ariaLabel,
}: {
  label: React.ReactNode;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} disabled={disabled} aria-label={ariaLabel} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="adm-confirm" role="alertdialog" aria-label={message}>
      <span>{message}</span>
      <button type="button" className="btn btn-sm danger" disabled={disabled} onClick={() => { setAsking(false); onConfirm(); }} autoFocus>
        {confirmLabel}
      </button>
      <button type="button" className="btn btn-sm" onClick={() => setAsking(false)}>取消</button>
    </span>
  );
}

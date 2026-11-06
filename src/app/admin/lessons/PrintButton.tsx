"use client";

// 列印教案（列印時會自動隱藏選單與按鈕）
export default function PrintButton() {
  return (
    <button type="button" className="btn btn-sm" onClick={() => window.print()}>
      🖨️ 列印
    </button>
  );
}

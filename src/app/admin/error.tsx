"use client";

// 後台出錯時的畫面（例如必填欄位漏填、網路中斷）
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="adm-panel">
      <h1>操作沒有成功</h1>
      <p>{error.message && !error.message.includes("Server Components") ? error.message : "可能是資料填寫不完整或網路不穩，請回上一頁再試一次。"}</p>
      {error.digest && <p className="hint">錯誤代碼：{error.digest}（回報問題時請附上）</p>}
      <div className="adm-btns">
        <button className="btn" onClick={() => reset()}>重試</button>
        <button className="btn" onClick={() => history.back()}>回上一頁</button>
      </div>
    </div>
  );
}

"use client";

import { useOptimistic } from "react";

type Option = { value: string; label: string; color: string };

// 點名按鈕：按下去畫面立刻變色，資料在背景存檔；存檔失敗會自動恢復原狀
export default function RollButtons({
  sessionId,
  studentId,
  nickname,
  current,
  options,
  action,
}: {
  sessionId: string;
  studentId: string;
  nickname: string;
  current: string | null;
  options: readonly Option[];
  action: (fd: FormData) => Promise<void>;
}) {
  const [status, setStatus] = useOptimistic(current);

  return (
    <div className="adm-roll-btns" role="group" aria-label={`${nickname} 出席狀態`}>
      {options.map((o) => (
        <form
          key={o.value}
          action={async (fd) => {
            setStatus(o.value);
            await action(fd);
          }}
        >
          <input type="hidden" name="session_id" value={sessionId} />
          <input type="hidden" name="student_id" value={studentId} />
          <input type="hidden" name="status" value={o.value} />
          <button
            type="submit"
            className={`adm-st adm-st-${o.color} ${status === o.value ? "on" : ""}`}
            aria-pressed={status === o.value}
          >
            {o.label}
          </button>
        </form>
      ))}
    </div>
  );
}

import Link from "next/link";
import CopyButton from "@/components/CopyButton";
import { requireStaff } from "@/lib/staff";
import { NOTICE_LABEL } from "@/lib/events";
import ActBtn from "../ActBtn";
import { logNotice } from "../actions";
import { loadQueue } from "../data";

export const metadata = { title: "要傳的私訊" };

// 後台：所有還沒傳的私訊（收到報名、請匯款、報名完成、課前提醒、停課通知）
export default async function MessagesPage() {
  await requireStaff(true);
  const { queue } = await loadQueue();
  const order = ["cancelled", "reminder", "pay", "paid", "registered"];
  queue.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

  return (
    <>
      <p className="hint"><Link href="/admin/events">← 活動報名</Link></p>
      <h1>要傳的私訊（{queue.length}）</h1>
      <p className="hint">
        按「複製」後到 FB 粉專或 IG 找到這位家長（看「私訊名」），貼上送出，再回來按「已傳私訊」。私訊範本可以在 <Link href="/admin/events/settings">設定</Link> 修改。
      </p>
      {queue.length === 0 && <p className="adm-empty">都傳完了 👍</p>}
      <div className="ev-queue">
        {queue.map((q) => (
          <article key={`${q.booking.id}-${q.kind}`} className="adm-panel ev-q">
            <div className="ev-q-head">
              <span className={`tag ${q.kind === "cancelled" ? "tag-red" : q.kind === "reminder" ? "tag-yellow" : "tag-blue"}`}>{q.title}</span>
              <strong>{q.booking.contact_name}</strong>
              <span>私訊名：{q.booking.social_name || "（未填）"}</span>
              <a href={`tel:${q.booking.phone}`} className="hint">{q.booking.phone}</a>
              <Link href={`/admin/events/runs/${q.runId}`} className="hint">{q.runTitle}{q.slotLabel ? `・${q.slotLabel}` : ""}</Link>
            </div>
            <pre className="ev-msg">{q.text}</pre>
            <div className="adm-btns">
              <CopyButton text={q.text} label="複製" className="btn btn-sm primary" />
              <ActBtn run={logNotice.bind(null, q.booking.id, q.kind, "dm")} label={`已傳私訊（${NOTICE_LABEL[q.kind]}）`} />
              <ActBtn run={logNotice.bind(null, q.booking.id, q.kind, "email")} label="已寄 Email" className="adm-link" />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import CopyButton from "@/components/CopyButton";
import { requireStaff } from "@/lib/staff";
import { isUuid } from "@/lib/supabase";
import {
  bookingLink,
  buildMessage,
  getSettings,
  gradeLabel,
  money,
  RUN_STATUS_LABEL,
  runTitle,
  siteUrl,
  suggestRefund,
  TEMPLATE_KEYS,
  UNIT_LABEL,
  WHO_LABEL,
  PAY_MODE_LABEL,
} from "@/lib/events";
import ActBtn from "../../ActBtn";
import { deleteRun, saveRun, saveSlot, setRunStatus } from "../../actions";
import { buildQueue, loadRunDetail } from "../../data";
import BookingRow from "./BookingRow";
import RunEditor from "./RunEditor";
import SlotCard from "./SlotCard";
import SlotEditor from "./SlotEditor";

export const metadata = { title: "開課與報名名單" };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> };

// 後台：一次開課的設定、場次、報名名單與對帳
export default async function RunPage({ params, searchParams }: Props) {
  await requireStaff(true);
  const { id } = await params;
  const { edit } = await searchParams;
  if (!isUuid(id)) notFound();
  const [d, settings] = await Promise.all([loadRunDetail(id), getSettings()]);
  if (!d) notFound();
  const { run, theme, slots, bookings } = d;
  const title = runTitle(run, theme);
  const unitLabel = UNIT_LABEL[run.unit];
  const publicUrl = `${siteUrl()}/signup/${run.id}`;
  const queue = buildQueue([d], settings);
  const paidTotal = bookings.filter((b) => b.status === "paid").reduce((s, b) => s + b.amount, 0);
  const toVerify = bookings.filter((b) => b.status === "pending" && b.pay_last5).length;
  const roster = slots
    .map((s) => {
      const list = bookings.filter((b) => b.slot_id === s.id && b.status === "paid").flatMap((b) => b.people.map((p) => `${p.name}${p.grade !== null ? `（${gradeLabel(p.grade)}）` : ""}`));
      return `${s.label}（${list.length}）\n${list.join("\n")}`;
    })
    .join("\n\n");

  return (
    <>
      <p className="hint"><Link href="/admin/events">← 活動報名</Link></p>
      <div className="adm-head">
        <h1>{title} <span className={`tag ${run.status === "open" ? "tag-green" : run.status === "draft" ? "tag-yellow" : "tag-gray"}`}>{RUN_STATUS_LABEL[run.status]}</span></h1>
        <div className="adm-actions">
          {run.status === "draft" && <ActBtn run={setRunStatus.bind(null, run.id, "open")} label="開放報名" className="btn btn-sm primary" ask="開放報名後官網就看得到，確定？" />}
          {run.status === "open" && <ActBtn run={setRunStatus.bind(null, run.id, "closed")} label="停止報名" ask="停止報名？官網會顯示目前沒有開放報名。" />}
          {run.status === "closed" && <ActBtn run={setRunStatus.bind(null, run.id, "open")} label="重新開放報名" />}
          {run.status !== "done" && run.status !== "draft" && <ActBtn run={setRunStatus.bind(null, run.id, "done")} label="活動已結束" ask="標記為已結束？" />}
          {run.status !== "draft" && <a className="btn btn-sm" href={`/signup/${run.id}`} target="_blank" rel="noopener noreferrer">看報名頁 ↗</a>}
        </div>
      </div>
      <p className="hint">
        主題：{theme.title}・{WHO_LABEL[run.who]}・名額算「{unitLabel}」・{PAY_MODE_LABEL[run.pay_mode]}
        {run.prices.length > 0 && <>・{run.prices.map((p) => `${p.label} $${money(p.amount)}`).join("、")}</>}
      </p>
      {run.status !== "draft" && (
        <div className="adm-panel ev-share">
          <span>報名網址（放海報、廣告、貼文）：</span>
          <code>{publicUrl}</code>
          <CopyButton text={publicUrl} label="複製網址" />
          <span className="hint">QR Code 可以用 Canva 或手機把這個網址轉成圖片。</span>
        </div>
      )}
      {!settings.bank?.trim() && <p className="adm-warn">⚠ 還沒有填匯款資訊，家長報名後看不到匯款帳號。請到 <Link href="/admin/events/settings">活動報名設定</Link> 填寫。</p>}

      <div className="ev-stats">
        <div><span className="adm-count">{bookings.filter((b) => b.status === "paid").reduce((s, b) => s + b.seats, 0)}</span> {unitLabel}報名完成</div>
        <div><span className="adm-count">{bookings.filter((b) => ["pending", "registered"].includes(b.status)).length}</span> 筆待匯款{toVerify > 0 && <>（{toVerify} 筆已回填末五碼）</>}</div>
        <div><span className="adm-count">{bookings.filter((b) => b.status === "waitlist").length}</span> 筆候補</div>
        <div><span className="adm-count">${money(paidTotal)}</span> 已收款</div>
        <div><span className="adm-count">{queue.length}</span> 則私訊待傳 {queue.length > 0 && <Link href="/admin/events/messages" className="adm-inline">去傳 →</Link>}</div>
      </div>

      <details className="ev-details" open={edit === "1" || run.status === "draft"}>
        <summary>開課設定（方案、題目、退費辦法）</summary>
        <RunEditor run={run} defaultRefund={settings.refund ?? ""} save={saveRun} />
      </details>

      <h2 className="ph-h">場次</h2>
      <div className="ev-slots">
        {slots.map((s) => <SlotCard key={`${s.id}-${s.state}-${s.first_start}`} slot={s} used={s.used} paid={s.paid} waiting={s.waiting} unitLabel={unitLabel} />)}
      </div>
      <details className="ev-details" open={slots.length === 0}>
        <summary>＋ 新增場次</summary>
        <div className="adm-panel"><SlotEditor runId={run.id} save={saveSlot} /></div>
      </details>

      <div className="adm-head">
        <h2 className="ph-h">報名名單</h2>
        {bookings.some((b) => b.status === "paid") && <CopyButton text={roster} label="複製已報名參加者（做桌牌用）" />}
      </div>
      {bookings.length === 0 && <p className="adm-empty">還沒有人報名。</p>}
      {slots.map((s) => {
        const list = bookings.filter((b) => b.slot_id === s.id);
        if (list.length === 0) return null;
        const order = ["pending", "registered", "paid", "waitlist", "cancelled", "refunded"];
        list.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.created_at.localeCompare(b.created_at));
        return (
          <section key={s.id} className="ev-list-sec">
            <h3>{s.label}（{list.length} 筆）</h3>
            <ul className="ev-bookings">
              {list.map((b) => {
                const ctx = { booking: b, people: b.people, run, theme, slot: s, link: bookingLink(b.code, b.token) };
                const next = queue.filter((q) => q.booking.id === b.id);
                const messages = [
                  ...next.map((q) => ({ key: `next-${q.kind}`, label: `建議：${q.title}`, kind: q.kind, text: q.text })),
                  ...TEMPLATE_KEYS.map((t) => ({ key: t.key, label: t.label, kind: t.kind, text: buildMessage(t.key, settings, ctx) })),
                ];
                const { token: _t, people, notices, ...rest } = b;
                void _t;
                return (
                  <BookingRow
                    key={`${b.id}-${b.status}-${b.notices.length}-${b.admin_note ?? ""}`}
                    b={rest}
                    people={people}
                    notices={notices}
                    messages={messages}
                    refundHint={suggestRefund(b.amount, s.first_start)}
                    link={ctx.link}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}

      {bookings.length === 0 && (
        <p className="hint ev-danger-zone">
          <ActBtn run={deleteRun.bind(null, run.id)} label="刪除這次開課" className="adm-link danger" ask="刪除這次開課（含場次）？" />
        </p>
      )}
    </>
  );
}

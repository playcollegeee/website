"use client";

import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import { BOOKING_STATUS_COLOR, BOOKING_STATUS_LABEL, gradeLabel, money, NOTICE_LABEL, type Booking, type BookingPerson, type Notice, type NoticeKind } from "@/lib/eventTypes";
import ActBtn from "../../ActBtn";
import { cancelBooking, logNotice, markPaid, markRefunded, promoteWaitlist, saveBookingNote, transferPeople, unmarkPaid } from "../../actions";

type Msg = { key: string; label: string; kind: NoticeKind; text: string };

// 台灣時間 11/8 23:33（自己組字串：伺服器與瀏覽器的 Intl 格式可能不同，會造成畫面對不上）
const fmt = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 8 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

// 後台：一筆報名（對帳、取消、退款、遞補、轉讓、備註、私訊稿）
export default function BookingRow({
  b,
  people,
  notices,
  messages,
  refundHint,
  link,
}: {
  b: Booking;
  people: BookingPerson[];
  notices: Notice[];
  messages: Msg[];
  refundHint: { amount: number; rule: string };
  link: string;
}) {
  const [panel, setPanel] = useState<"" | "cancel" | "transfer" | "note" | "dm">("");
  const [refund, setRefund] = useState(String(b.status === "paid" ? refundHint.amount : 0));
  const [reason, setReason] = useState("");
  const [names, setNames] = useState(people.map((p) => ({ id: p.id, name: p.name })));
  const [note, setNote] = useState(b.admin_note ?? "");
  const [msgKey, setMsgKey] = useState(messages[0]?.key ?? "");
  const msg = messages.find((m) => m.key === msgKey);
  const active = !["cancelled", "refunded"].includes(b.status);
  const toggle = (p: typeof panel) => setPanel(panel === p ? "" : p);

  return (
    <li className={`ev-booking st-${b.status}`}>
      <div className="ev-b-main">
        <div className="ev-b-who">
          <span className="ev-code">{b.code}</span>
          <strong>{people.map((p) => p.name).join("、")}</strong>
          <span className="hint">{people.map((p) => (p.kind === "adult" ? "大人" : gradeLabel(p.grade))).join("、")}</span>
          {people.some((p) => p.care_notes) && <span className="tag tag-red" title={people.map((p) => p.care_notes).filter(Boolean).join("；")}>注意事項</span>}
        </div>
        <div className="ev-b-contact">
          {b.contact_name}・<a href={`tel:${b.phone}`}>{b.phone}</a>
          {b.social_name && <>・私訊名：{b.social_name}</>}
          {b.email && <><br /><span className="hint">{b.email}</span></>}
        </div>
        <div className="ev-b-pay">
          <span>{b.price_label}{b.qty > 1 ? `×${b.qty}` : ""} ${money(b.amount)}</span>
          {b.pay_last5 && <span className="tag tag-yellow">末五碼 {b.pay_last5}</span>}
          {b.claims_returning && !b.is_returning && <span className="tag tag-red" title="選了舊生方案，但系統查不到以前的報名紀錄（舊表單還沒匯入），請核對">舊生待核對</span>}
          {b.is_returning && <span className="tag tag-green">舊生</span>}
          {!b.photo_ok && <span className="tag tag-gray">照片不公開</span>}
        </div>
        <div className="ev-b-status">
          <span className={`tag tag-${BOOKING_STATUS_COLOR[b.status]}`}>{BOOKING_STATUS_LABEL[b.status]}</span>
          {b.refund_amount !== null && b.status !== "paid" && <span className="hint">退款 ${money(b.refund_amount)}</span>}
          <span className="hint">{fmt(b.created_at)} 報名</span>
        </div>
      </div>
      {(people.some((p) => p.care_notes) || b.message || Object.keys(b.answers ?? {}).length > 0 || b.admin_note || b.cancel_reason) && (
        <div className="ev-b-notes hint">
          {people.filter((p) => p.care_notes).map((p) => <div key={p.id}>⚠ {p.name}：{p.care_notes}</div>)}
          {Object.entries(b.answers ?? {}).map(([k, v]) => <div key={k}>Q：{v}</div>)}
          {b.message && <div>家長留言：{b.message}</div>}
          {b.cancel_reason && <div>取消原因：{b.cancel_reason}</div>}
          {b.admin_note && <div>老師備註：{b.admin_note}</div>}
        </div>
      )}
      <div className="adm-btns ev-b-actions">
        {["pending", "registered"].includes(b.status) && <ActBtn run={() => markPaid(b.id)} label="✓ 確認收款" className="btn btn-sm primary" />}
        {b.status === "paid" && <ActBtn run={() => unmarkPaid(b.id)} label="改回待匯款" ask="確定改回待匯款？" />}
        {b.status === "waitlist" && <ActBtn run={() => promoteWaitlist(b.id)} label="遞補" className="btn btn-sm primary" />}
        {b.status === "cancelled" && b.refund_amount ? <ActBtn run={() => markRefunded(b.id)} label="標記已退款" /> : null}
        {messages.length > 0 && <button type="button" className="btn btn-sm" onClick={() => toggle("dm")}>💬 私訊稿</button>}
        {active && <button type="button" className="btn btn-sm" onClick={() => toggle("transfer")}>轉讓</button>}
        <button type="button" className="btn btn-sm" onClick={() => toggle("note")}>備註</button>
        {active && <button type="button" className="adm-link danger" onClick={() => toggle("cancel")}>取消報名</button>}
        <CopyButton text={link} label="複製家長查詢連結" className="adm-link" />
      </div>

      {panel === "dm" && msg && (
        <div className="ev-panel">
          <select value={msgKey} onChange={(e) => setMsgKey(e.target.value)} aria-label="選擇私訊範本">
            {messages.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <pre className="ev-msg">{msg.text}</pre>
          <div className="adm-btns">
            <CopyButton text={msg.text} label="複製" className="btn btn-sm primary" />
            <ActBtn run={() => logNotice(b.id, msg.kind, "dm")} label={`已傳私訊（${NOTICE_LABEL[msg.kind]}）`} />
          </div>
        </div>
      )}
      {panel === "cancel" && (
        <div className="ev-panel">
          {b.status === "paid" ? (
            <>
              <p className="hint">依退費辦法建議：{refundHint.rule}，退 ${money(refundHint.amount)}。可以自行調整（病假、颱風、主辦取消等）。</p>
              <label className="ev-inline">退款金額 $<input type="number" min={0} max={b.amount} value={refund} onChange={(e) => setRefund(e.target.value)} /></label>
            </>
          ) : (
            <p className="hint">還沒繳費，取消後名額直接釋出。</p>
          )}
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="取消原因（例：家長來訊取消、改報下一場）" maxLength={200} />
          <ActBtn run={() => cancelBooking(b.id, b.status === "paid" ? Number(refund) : null, reason)} label="確定取消這筆報名" className="btn btn-sm danger" />
        </div>
      )}
      {panel === "transfer" && (
        <div className="ev-panel">
          <p className="hint">只改參加者姓名，不退費、不重新報名。</p>
          {names.map((n, i) => (
            <input key={n.id} value={n.name} maxLength={40} onChange={(e) => setNames(names.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label={`參加者 ${i + 1}`} />
          ))}
          <ActBtn run={() => transferPeople(b.id, names)} label="儲存參加者" className="btn btn-sm primary" />
        </div>
      )}
      {panel === "note" && (
        <div className="ev-panel">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="只有老師看得到" />
          <ActBtn run={() => saveBookingNote(b.id, note)} label="儲存備註" className="btn btn-sm primary" />
        </div>
      )}
      {notices.length > 0 && (
        <p className="hint ev-sent">已傳：{notices.map((n) => `${NOTICE_LABEL[n.kind]}${n.channel === "email" ? "（Email）" : ""} ${fmt(n.sent_at)}`).join("、")}</p>
      )}
    </li>
  );
}

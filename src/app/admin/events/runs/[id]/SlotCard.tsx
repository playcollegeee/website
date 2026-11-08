"use client";

import { useState } from "react";
import { fmtTimes, SLOT_STATE_LABEL, type Slot } from "@/lib/eventTypes";
import ActBtn from "../../ActBtn";
import { cancelSlot, confirmSlot, deleteSlot, reopenSlot, saveSlot } from "../../actions";
import SlotEditor from "./SlotEditor";

// 後台：場次摘要＋確定開課／停課／編輯
export default function SlotCard({ slot, used, paid, waiting, unitLabel }: { slot: Slot; used: number; paid: number; waiting: number; unitLabel: string }) {
  const [edit, setEdit] = useState(false);
  const [reason, setReason] = useState("未達開課人數");
  const [askCancel, setAskCancel] = useState(false);
  const enough = paid >= slot.min_seats;
  return (
    <div className={`ev-slot state-${slot.state}`}>
      <div className="ev-slot-head">
        <div>
          <strong>{slot.label}</strong>
          <span className={`tag ${slot.state === "confirmed" ? "tag-green" : slot.state === "cancelled" ? "tag-red" : "tag-blue"}`}>{SLOT_STATE_LABEL[slot.state]}</span>
          <div className="hint">{fmtTimes(slot.times) || "還沒填上課時間"}</div>
          {(slot.venue || slot.address) && <div className="hint">{[slot.venue, slot.address].filter(Boolean).join("，")}</div>}
        </div>
        <div className="ev-meter" aria-label={`已報名 ${used}／${slot.capacity}`}>
          <span className="adm-count">{used}</span>／{slot.capacity} {unitLabel}
          <div className="hint">已繳費 {paid}・候補 {waiting}・最低 {slot.min_seats}</div>
          {slot.state === "open" && <div className={enough ? "ev-ok" : "adm-warn"}>{enough ? "已達開課人數" : `還差 ${slot.min_seats - paid} ${unitLabel}`}</div>}
        </div>
      </div>
      <div className="adm-btns">
        {slot.state === "open" && <ActBtn run={() => confirmSlot(slot.id)} label="確定開課" className="btn btn-sm primary" ask="確定開課？先登記後匯款的報名會改成待匯款，私訊清單會出現「請匯款」。" />}
        {slot.state !== "cancelled" && !askCancel && <button type="button" className="adm-link danger" onClick={() => setAskCancel(true)}>停課</button>}
        {slot.state !== "open" && <ActBtn run={() => reopenSlot(slot.id)} label="改回招生中" />}
        <button type="button" className="btn btn-sm" onClick={() => setEdit(!edit)}>{edit ? "收起" : "編輯場次"}</button>
        {used === 0 && waiting === 0 && <ActBtn run={() => deleteSlot(slot.id)} label="刪除" className="adm-link danger" ask="刪除這個場次？" />}
      </div>
      {askCancel && (
        <div className="ev-panel">
          <p className="hint">停課後，這個場次所有報名都會改成取消；已繳費的預設全額退款，私訊清單會出現停課通知。</p>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={100} aria-label="停課原因" />
          <div className="adm-btns">
            <ActBtn run={() => cancelSlot(slot.id, reason)} label="確定停課" className="btn btn-sm danger" />
            <button type="button" className="btn btn-sm" onClick={() => setAskCancel(false)}>取消</button>
          </div>
        </div>
      )}
      {edit && <SlotEditor runId={slot.run_id} slot={slot} save={saveSlot} onDone={() => setEdit(false)} />}
    </div>
  );
}

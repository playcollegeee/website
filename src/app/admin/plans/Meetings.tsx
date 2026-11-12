"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fmtDay, who, type AgendaItem } from "@/lib/plans";
import { ROOM_CTA, meetingStatus, type Meeting } from "@/lib/meetingTypes";
export type { Meeting };
import Agenda from "./Agenda";
import { planMeeting } from "./meetingActions";
import { PhaseBox, useRecorder } from "./useRecorder";

type T = { id: string; name: string; nickname: string | null };
// 規劃頁的會議區塊：一開始只有「安排會議」與「匯入會議錄音檔」；
// 待開會的會議顯示議程與會議室入口，其他會議一行一場，詳細內容都在會議室
export default function Meetings({
  planId, meetings, agenda, teachers, me, isAdmin, canEditPlan, sttReady,
}: {
  planId: string; meetings: Meeting[]; agenda: AgendaItem[]; teachers: T[]; me: string; isAdmin: boolean;
  canEditPlan: boolean; sttReady: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [planning, startPlan] = useTransition();
  const [consent, setConsent] = useState(false);
  const rec = useRecorder(planId, () => setConsent(false));
  // 只展開最新一場待開會的會議（議程＋會議室入口），其他一行一場
  const next = meetings.filter((m) => m.status === "planned").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const planned = next ? [next] : [];
  const others = meetings.filter((m) => m.id !== next?.id);

  return (
    <section className="adm-panel pln-meetings">
      <h2>🗓️ 會議</h2>
      {rec.fileInput}
      <div className="pln-meet-start">
        <button type="button" className="btn primary" disabled={planning || rec.busy}
          onClick={() => startPlan(async () => {
            const r = await planMeeting({ planId });
            setMsg(r.ok ? null : r.message);
            if (r.ok) router.refresh();
          })}>
          {planning ? "安排中…" : "📅 安排會議"}
        </button>
        {sttReady && (
          <details className="pln-meet-new">
            <summary>點我匯入會議錄音檔</summary>
            <p className="hint">沒有事先安排的會議也可以直接匯入，系統會自動編成下一次會議。手機用內建「錄音」App 錄好即可（m4a、mp3、wav），錄音只用來轉成文字，不會保存。</p>
            <label className="adm-check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={rec.busy} />
              開會錄音前已告知與會老師，大家都同意錄音
            </label>
            <button type="button" className="btn btn-sm primary" disabled={rec.busy || !consent} onClick={() => rec.pick()}>
              📁 選擇錄音檔並開始整理
            </button>
          </details>
        )}
      </div>
      {msg && <p className="notice err">{msg}</p>}
      <PhaseBox phase={rec.phase} resumeId={rec.resumeId} pick={rec.pick} />

      {planned.map((m) => (
        <div key={m.id} className="pln-meet-next">
          <div className="pln-meet-next-head">
            <h3>{m.title}<small className="muted">　{m.held_on ? fmtDay(m.held_on) : ""}・{who(m.creator ?? null)} 安排</small></h3>
            <Link className="btn primary" href={`/admin/meetings/${m.id}`}>{ROOM_CTA}</Link>
          </div>
          <Agenda meetingId={m.id} items={agenda.filter((a) => a.meeting_id === m.id)} teachers={teachers} me={me} isAdmin={isAdmin}
            canManage={m.created_by === me || canEditPlan} showResults={false} />
        </div>
      ))}

      {others.length > 0 && (
        <ul className="pln-meet-list">
          {others.map((m) => (
            <li key={m.id}>
              <strong>{m.title}</strong>
              <small className="muted">{m.held_on ? fmtDay(m.held_on) : ""}・{meetingStatus(m)}</small>
              <Link className="adm-link" href={`/admin/meetings/${m.id}`}>進入會議室 →</Link>
            </li>
          ))}
        </ul>
      )}
      {meetings.length === 0 && <p className="muted">還沒有會議。按「安排會議」會自動建立「第 1 次會議」，可以先擬議程，開會時進入會議室一起討論。</p>}
    </section>
  );
}

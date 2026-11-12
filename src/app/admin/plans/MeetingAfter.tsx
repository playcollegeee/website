"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import ConfirmButton from "@/app/admin/ConfirmButton";
import { applyMeeting, deleteMeeting, getTranscript, saveMeetingSummary, summarizeMeeting } from "./meetingActions";
import type { Meeting } from "./Meetings";
import { PhaseBox, useRecorder } from "./useRecorder";

type T = { id: string; name: string; nickname: string | null };

// 會議室下方「開完會後」：匯入錄音、AI 整理的摘要、決議、待辦（勾選後套用到規劃）、逐字稿、刪除會議
export default function MeetingAfter({
  m, planId, teachers, me, isAdmin, canEditPlan, sttReady,
}: {
  m: Meeting; planId: string | null; teachers: T[]; me: string; isAdmin: boolean; canEditPlan: boolean; sttReady: boolean;
}) {
  const router = useRouter();
  const rec = useRecorder(planId);
  const busy = rec.busy;
  const onResume = () => rec.pick(m.id);
  const onAttach = () => rec.pick(undefined, m.id);
  const ai = m.ai_result;
  const findTeacher = (n: string) => {
    const s = n.trim();
    if (!s) return "";
    return teachers.find((t) => t.name === s || t.nickname === s || s.includes(t.name) || (t.nickname && s.includes(t.nickname)))?.id ?? "";
  };
  const [dec, setDec] = useState(() => (ai?.decisions ?? []).map((text) => ({ text, on: true })));
  const [tasks, setTasks] = useState(() => (ai?.tasks ?? []).map((t) => ({ title: t.title, assigneeId: findTeacher(t.assignee), due: t.due, on: true })));
  const [summary, setSummary] = useState(m.summary ?? "");
  const [editSum, setEditSum] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const done = m.parts?.[0]?.count ?? 0;
  const canEditSum = m.created_by === me || canEditPlan;
  const [consent, setConsent] = useState(false);
  const planned = m.status === "planned";
  const run = (fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) =>
    start(async () => { const r = await fn(); setMsg({ ok: r.ok, text: r.message }); if (r.ok) { after?.(); router.refresh(); } });

  return (
    <div className="pln-meet-after">
      {rec.fileInput}
      <PhaseBox phase={rec.phase} resumeId={rec.resumeId} pick={rec.pick} />
      {planned && (
        <>
          <div className="pln-meet-attach">
            <h4>🎙️ 匯入這場會議的錄音</h4>
            {sttReady ? (
              <>
                <label className="adm-check">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={busy} />
                  開會錄音前已告知與會老師，大家都同意錄音
                </label>
                <button type="button" className="btn btn-sm primary" disabled={busy || !consent} onClick={onAttach}>📁 匯入這場會議的錄音</button>
                <p className="hint">AI 會依上面的議程逐項整理結論，再整理摘要、決議、待辦。</p>
              </>
            ) : <p className="hint">還沒設定語音轉文字的金鑰。</p>}
          </div>
        </>
      )}

      {!planned && m.status !== "ready" && (
        <div className="pln-meet-todo">
          {done < m.parts_total ? (
            <>
              <p>錄音還沒全部轉成文字（{done}／{m.parts_total} 段）。</p>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={onResume}>▶ 繼續（選同一個錄音檔）</button>
            </>
          ) : (
            <>
              <p>逐字稿已完成，還沒整理。</p>
              <button type="button" className="btn btn-sm primary" disabled={pending || busy} onClick={() => run(() => summarizeMeeting(m.id))}>
                {pending ? "AI 整理中…" : "✨ 請 AI 整理"}
              </button>
            </>
          )}
        </div>
      )}

      {m.status === "ready" && (
        <>
          <h4>摘要</h4>
          {editSum ? (
            <div className="pln-c-edit">
              <textarea rows={6} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={4000} aria-label="摘要" />
              <div className="adm-btns">
                <button type="button" className="btn btn-sm primary" disabled={pending} onClick={() => run(() => saveMeetingSummary(m.id, summary), () => setEditSum(false))}>儲存</button>
                <button type="button" className="btn btn-sm" onClick={() => { setEditSum(false); setSummary(m.summary ?? ""); }}>取消</button>
              </div>
            </div>
          ) : (
            <>
              <p className="pln-pre">{m.summary || "（沒有摘要）"}</p>
              {canEditSum && <button type="button" className="adm-link" onClick={() => setEditSum(true)}>修改摘要</button>}
            </>
          )}

          {ai && (
            <div className="pln-meet-apply">
              <h4>✅ 決議 <small>勾選要加入規劃「決議」的項目，文字可以修改</small></h4>
              {dec.length === 0 && <p className="muted">AI 沒有找到明確的決議。</p>}
              {dec.map((d, i) => (
                <div key={i} className="pln-apply-row">
                  <input type="checkbox" checked={d.on} onChange={(e) => setDec((a) => a.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} aria-label="加入這項決議" />
                  <input value={d.text} onChange={(e) => setDec((a) => a.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} maxLength={500} aria-label="決議內容" />
                </div>
              ))}
              <h4>📌 待辦 <small>確認負責老師與期限</small></h4>
              {tasks.length === 0 && <p className="muted">AI 沒有找到待辦事項。</p>}
              {tasks.map((t, i) => (
                <div key={i} className="pln-apply-row task">
                  <input type="checkbox" checked={t.on} onChange={(e) => setTasks((a) => a.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} aria-label="加入這項待辦" />
                  <input value={t.title} onChange={(e) => setTasks((a) => a.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} maxLength={300} aria-label="待辦內容" />
                  <select value={t.assigneeId} onChange={(e) => setTasks((a) => a.map((x, j) => (j === i ? { ...x, assigneeId: e.target.value } : x)))} aria-label="負責老師">
                    <option value="">未指派</option>
                    {teachers.map((x) => <option key={x.id} value={x.id}>{x.nickname || x.name}</option>)}
                  </select>
                  <input type="date" value={t.due} onChange={(e) => setTasks((a) => a.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} aria-label="期限" />
                </div>
              ))}
              {ai.open_questions.length > 0 && (
                <>
                  <h4>❓ 待討論事項 <small>還沒有結論</small></h4>
                  <ul>{ai.open_questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                </>
              )}
              <div className="adm-btns">
                {(() => {
                  const doApply = () => run(() => applyMeeting({
                    id: m.id,
                    decisions: canEditPlan ? dec.filter((d) => d.on).map((d) => d.text) : [],
                    tasks: tasks.filter((t) => t.on).map(({ title, assigneeId, due }) => ({ title, assigneeId, due })),
                  }));
                  const off = pending || (!dec.some((d) => d.on) && !tasks.some((t) => t.on));
                  return m.applied_at ? (
                    <ConfirmButton className="btn btn-sm" label="再套用一次" disabled={off} confirmLabel="再套用"
                      message="這場會議已經套用過，再套用一次會重複加入，確定嗎？" onConfirm={doApply} />
                  ) : (
                    <button type="button" className="btn btn-sm primary" disabled={off} onClick={doApply}>{pending ? "套用中…" : "套用到規劃"}</button>
                  );
                })()}
                {!canEditPlan && <small className="muted">決議只有規劃負責人可以套用；你可以先套用待辦。</small>}
              </div>
            </div>
          )}
        </>
      )}

      <div className="pln-meet-foot">
        <button type="button" className="adm-link" disabled={pending}
          onClick={() => transcript === null ? start(async () => { const r = await getTranscript(m.id); setTranscript(r.ok ? r.text : r.message ?? ""); }) : setTranscript(null)}>
          {transcript === null ? "📄 看逐字稿" : "收起逐字稿"}
        </button>
        {(isAdmin || m.created_by === me) && (
          <ConfirmButton label="刪除會議紀錄" disabled={pending}
            message={`確定刪除「${m.title}」的會議紀錄與逐字稿？已套用到規劃的決議、待辦不會被刪除。`}
            onConfirm={() => start(async () => {
              const r = await deleteMeeting(m.id);
              if (r.ok) router.push(planId ? `/admin/plans/${planId}` : "/admin"); else setMsg({ ok: false, text: r.message });
            })} />
        )}
      </div>
      {transcript !== null && <div className="pln-transcript pln-pre">{transcript || "（沒有內容）"}</div>}
      {msg && <p className={`notice ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</p>}
    </div>
  );
}

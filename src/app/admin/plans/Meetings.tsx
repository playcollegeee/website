"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { RATE, decodeMono16k, encodeWav, splitPoints } from "@/lib/audioChunks";
import { fmtDay, who, type Person } from "@/lib/plans";
import {
  applyMeeting, createMeeting, deleteMeeting, getTranscript, meetingProgress, saveMeetingSummary, summarizeMeeting, transcribePart,
  type MeetingAi,
} from "./meetingActions";

type T = { id: string; name: string; nickname: string | null };
export type Meeting = {
  id: string; title: string; held_on: string | null; status: string; parts_total: number; duration_sec: number | null;
  summary: string | null; ai_result: MeetingAi | null; applied_at: string | null; created_by: string | null; created_at: string;
  creator?: Person; parts?: { count: number }[];
};
type Phase = { step: "idle" | "decoding" | "sending" | "summarizing" | "done" | "error"; done?: number; total?: number; text?: string };

const mins = (s: number | null) => (s ? `${Math.max(1, Math.round(s / 60))} 分鐘` : "");
const today = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

// 匯入手機錄音 → 瀏覽器切段 → 一段一段轉文字 → AI 整理摘要、決議、待辦 → 老師挑選後套用到規劃
export default function Meetings({
  planId, meetings, teachers, me, isAdmin, canEditPlan, sttReady,
}: {
  planId: string; meetings: Meeting[]; teachers: T[]; me: string; isAdmin: boolean; canEditPlan: boolean; sttReady: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [heldOn, setHeldOn] = useState(today());
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [resumeId, setResumeId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = ["decoding", "sending", "summarizing"].includes(phase.step);

  async function run(file: File, existingId?: string) {
    let lock: { release: () => Promise<void> } | null = null;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    try {
      // 處理中讓螢幕不要關（瀏覽器支援才會生效）
      lock = await (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } })
        .wakeLock?.request("screen").catch(() => null) ?? null;
      setPhase({ step: "decoding", text: "正在讀取錄音檔…（長的錄音要等 10–30 秒）" });
      let samples: Float32Array;
      try { samples = await decodeMono16k(file); } catch {
        throw new Error("讀不出這個錄音檔。請用 m4a、mp3、wav 格式，或改用電腦匯入（手機記憶體可能不夠）");
      }
      const points = splitPoints(samples);
      const duration = samples.length / RATE;
      if (duration < 5) throw new Error("錄音太短了");
      let id = existingId;
      let done = new Set<number>();
      if (id) {
        const p = await meetingProgress(id);
        if (!p.ok) throw new Error(p.message ?? "讀取進度失敗");
        if (p.total !== points.length) throw new Error("這不是同一個錄音檔（長度不同），請選原本匯入的那個檔案");
        done = new Set(p.done);
      } else {
        const r = await createMeeting({ planId, title: title || `會議 ${fmtDay(heldOn)}`, heldOn, partsTotal: points.length, durationSec: duration, consent });
        if (!r.ok || !r.id) throw new Error(r.message);
        id = r.id;
        setTitle("");
        setConsent(false);
      }
      setResumeId(id);
      for (let i = 0; i < points.length; i++) {
        if (done.has(i)) continue;
        setPhase({ step: "sending", done: done.size, total: points.length });
        const [s, e] = points[i];
        const fd = new FormData();
        fd.set("meetingId", id);
        fd.set("idx", String(i));
        fd.set("audio", encodeWav(samples.subarray(s, e)), `part${i}.wav`);
        let r = await transcribePart(fd);
        if (!r.ok) { await new Promise((ok) => setTimeout(ok, 3000)); r = await transcribePart(fd); } // 失敗自動重試一次
        if (!r.ok) throw new Error(`${r.message}（已完成 ${done.size}／${points.length} 段，可以按「繼續」選同一個錄音檔接著做）`);
        done.add(i);
      }
      setPhase({ step: "summarizing", text: "AI 正在整理摘要、決議和待辦…（約 20–50 秒）" });
      const r = await summarizeMeeting(id);
      if (!r.ok) throw new Error(`${r.message}（逐字稿已完成，可以在下面按「重新整理」）`);
      setPhase({ step: "done", text: "完成！請在下面查看摘要，勾選要套用的決議與待辦。" });
      setResumeId(null);
      router.refresh();
    } catch (e) {
      setPhase({ step: "error", text: e instanceof Error ? e.message : "處理失敗，請再試一次" });
      router.refresh();
    } finally {
      window.removeEventListener("beforeunload", guard);
      void lock?.release().catch(() => {});
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const pick = (existingId?: string) => {
    const input = fileRef.current;
    if (!input) return;
    input.onchange = () => { const f = input.files?.[0]; if (f) void run(f, existingId); };
    input.click();
  };

  return (
    <section className="adm-panel pln-meetings">
      <h2>🎙️ 會議紀錄 <small>手機錄音匯入，AI 整理摘要、決議、待辦</small></h2>
      <input ref={fileRef} type="file" accept="audio/*,.m4a,.mp3,.wav,.aac,.amr,.3gp,.ogg,.webm" hidden />
      {!sttReady ? (
        <p className="hint">還沒設定語音轉文字的金鑰（管理員到 Vercel 設定 OPENAI_API_KEY 後就能使用）。</p>
      ) : (
        <div className="pln-meet-new">
          <div className="pln-meet-row">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={`會議名稱（預設：會議 ${fmtDay(heldOn)}）`} aria-label="會議名稱" disabled={busy} />
            <input type="date" value={heldOn} onChange={(e) => setHeldOn(e.target.value)} aria-label="開會日期" disabled={busy} />
          </div>
          <label className="adm-check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={busy} />
            開會錄音前已告知與會老師，大家都同意錄音
          </label>
          <button type="button" className="btn primary" disabled={busy || !consent} onClick={() => pick()}>
            📁 選擇手機錄音檔並開始整理
          </button>
          <p className="hint">
            手機用內建的「錄音」App 錄好，傳到電腦或直接在手機選檔（m4a、mp3、wav 都可以）。錄音只用來轉成文字，不會保存在網站上。
            長的會議建議用電腦匯入；處理時請不要關掉這個分頁。
          </p>
        </div>
      )}
      {phase.step !== "idle" && (
        <div className={`pln-meet-phase ${phase.step}`} role="status">
          {phase.step === "sending" ? (
            <>
              <p>正在轉成文字：{phase.done}／{phase.total} 段（每段約 1.5 分鐘）</p>
              <progress max={phase.total} value={phase.done} />
            </>
          ) : <p>{phase.text}</p>}
          {phase.step === "error" && resumeId && (
            <button type="button" className="btn btn-sm" onClick={() => pick(resumeId)}>▶ 繼續（選同一個錄音檔）</button>
          )}
        </div>
      )}

      {meetings.length === 0 && <p className="muted">還沒有會議紀錄。</p>}
      {meetings.map((m) => (
        <MeetingCard key={`${m.id}-${m.status}-${m.applied_at ?? ""}`} m={m} teachers={teachers} me={me} isAdmin={isAdmin}
          canEditPlan={canEditPlan} busy={busy} onResume={() => pick(m.id)} />
      ))}
    </section>
  );
}

function MeetingCard({
  m, teachers, me, isAdmin, canEditPlan, busy, onResume,
}: { m: Meeting; teachers: T[]; me: string; isAdmin: boolean; canEditPlan: boolean; busy: boolean; onResume: () => void }) {
  const router = useRouter();
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
  const run = (fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) =>
    start(async () => { const r = await fn(); setMsg({ ok: r.ok, text: r.message }); if (r.ok) { after?.(); router.refresh(); } });

  return (
    <details className="pln-meet" open={m.status === "ready" && !m.applied_at}>
      <summary>
        <strong>{m.title}</strong>
        <small className="muted">
          {m.held_on ? fmtDay(m.held_on) : ""} {mins(m.duration_sec)}・{who(m.creator ?? null)} 匯入
          {m.status === "ready" ? (m.applied_at ? "・✅ 已套用到規劃" : "・📝 待確認") : m.status === "summarizing" ? "・AI 整理中" : `・轉文字 ${done}／${m.parts_total}`}
        </small>
      </summary>

      {m.status !== "ready" && (
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
                <button type="button" className="btn btn-sm primary" disabled={pending || (!dec.some((d) => d.on) && !tasks.some((t) => t.on))}
                  onClick={() => {
                    if (m.applied_at && !confirm("這場會議已經套用過，再套用一次會重複加入，確定嗎？")) return;
                    run(() => applyMeeting({
                      id: m.id,
                      decisions: canEditPlan ? dec.filter((d) => d.on).map((d) => d.text) : [],
                      tasks: tasks.filter((t) => t.on).map(({ title, assigneeId, due }) => ({ title, assigneeId, due })),
                    }));
                  }}>
                  {pending ? "套用中…" : m.applied_at ? "再套用一次" : "套用到規劃"}
                </button>
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
          <button type="button" className="adm-link danger" disabled={pending}
            onClick={() => confirm(`確定刪除「${m.title}」的會議紀錄與逐字稿？已套用到規劃的決議、待辦不會被刪除。`) && run(() => deleteMeeting(m.id))}>
            刪除會議紀錄
          </button>
        )}
      </div>
      {transcript !== null && <div className="pln-transcript pln-pre">{transcript || "（沒有內容）"}</div>}
      {msg && <p className={`notice ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</p>}
    </details>
  );
}

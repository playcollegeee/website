"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyBoardAi, type BoardAi } from "./actions";

type T = { id: string; name: string; nickname: string | null };

// ✨ AI 整理的結果：分群（可一鍵排列白板）、重複的便利貼、決議與待辦候選（勾選後套用到規劃）
export default function BoardAiPanel({
  ai, meetingId, planId, canDecide, teachers, textOf, onArrange, onClose,
}: {
  ai: BoardAi; meetingId: string; planId: string | null; canDecide: boolean; teachers: T[];
  textOf: (id: string) => string; onArrange: (groups: BoardAi["groups"]) => void; onClose: () => void;
}) {
  const router = useRouter();
  const findTeacher = (n: string) => {
    const s = n.trim();
    if (!s) return "";
    return teachers.find((t) => t.name === s || t.nickname === s || s.includes(t.name) || (t.nickname && s.includes(t.nickname)))?.id ?? "";
  };
  const [dec, setDec] = useState(() => ai.decisions.map((text) => ({ text, on: true })));
  const [tasks, setTasks] = useState(() => ai.tasks.map((t) => ({ title: t.title, assigneeId: findTeacher(t.assignee), due: t.due, on: true })));
  const [arranged, setArranged] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const short = (id: string) => { const t = textOf(id); return t.length > 24 ? t.slice(0, 24) + "…" : t || "（空白）"; };
  const nothing = !dec.some((d) => d.on) && !tasks.some((t) => t.on);

  return (
    <section className="bd-ai" aria-label="AI 整理的建議">
      <div className="bd-ai-head">
        <strong>✨ AI 整理的建議</strong>
        <small className="muted">只是建議，按下按鈕才會排列白板或寫進規劃</small>
        <button type="button" className="adm-link" onClick={onClose}>關閉</button>
      </div>
      {ai.summary && <p className="bd-ai-sum">{ai.summary}</p>}

      <h4>🗂️ 分群 <small>{ai.groups.length} 群</small></h4>
      <ul className="bd-ai-groups">
        {ai.groups.map((g, i) => (
          <li key={i}><strong>{g.title}</strong><small className="muted">（{g.noteIds.length} 張）</small> {g.noteIds.map(short).join("／")}</li>
        ))}
      </ul>
      <button type="button" className="btn btn-sm primary" disabled={!ai.groups.length || arranged}
        onClick={() => { onArrange(ai.groups); setArranged(true); }}>
        {arranged ? "✅ 已排列" : "依分群排列白板"}
      </button>
      <small className="muted">　會在白板右邊建立分區框，把便利貼排進去；原本的位置可以再拖回來。</small>

      {ai.duplicates.length > 0 && (
        <>
          <h4>🔁 可能重複</h4>
          <ul>{ai.duplicates.map((d, i) => <li key={i}>{d.noteIds.map(short).join(" ／ ")}<small className="muted">　{d.reason}</small></li>)}</ul>
        </>
      )}

      {planId ? (
        <>
          <h4>✅ 決議候選 <small>勾選要加入規劃「決議」的項目，文字可以修改</small></h4>
          {dec.length === 0 && <p className="muted">白板上還看不出明確的決議。</p>}
          {dec.map((d, i) => (
            <div key={i} className="pln-apply-row">
              <input type="checkbox" checked={d.on} disabled={!canDecide} onChange={(e) => setDec((a) => a.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} aria-label="加入這項決議" />
              <input value={d.text} maxLength={500} onChange={(e) => setDec((a) => a.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} aria-label="決議內容" />
            </div>
          ))}
          {!canDecide && dec.length > 0 && <small className="muted">決議只有規劃負責人可以套用；你可以先套用待辦。</small>}
          <h4>📌 待辦候選 <small>確認負責老師與期限</small></h4>
          {tasks.length === 0 && <p className="muted">白板上沒有提到要做的事。</p>}
          {tasks.map((t, i) => (
            <div key={i} className="pln-apply-row task">
              <input type="checkbox" checked={t.on} onChange={(e) => setTasks((a) => a.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} aria-label="加入這項待辦" />
              <input value={t.title} maxLength={300} onChange={(e) => setTasks((a) => a.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} aria-label="待辦內容" />
              <select value={t.assigneeId} onChange={(e) => setTasks((a) => a.map((x, j) => (j === i ? { ...x, assigneeId: e.target.value } : x)))} aria-label="負責老師">
                <option value="">未指派</option>
                {teachers.map((x) => <option key={x.id} value={x.id}>{x.nickname || x.name}</option>)}
              </select>
              <input type="date" value={t.due} onChange={(e) => setTasks((a) => a.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} aria-label="期限" />
            </div>
          ))}
          <div className="adm-btns">
            <button type="button" className="btn btn-sm primary" disabled={pending || nothing}
              onClick={() => start(async () => {
                const r = await applyBoardAi({
                  meetingId,
                  decisions: canDecide ? dec.filter((d) => d.on).map((d) => d.text) : [],
                  tasks: tasks.filter((t) => t.on).map(({ title, assigneeId, due }) => ({ title, assigneeId, due })),
                });
                setMsg({ ok: r.ok, text: r.message });
                if (r.ok) { setDec((a) => a.map((x) => ({ ...x, on: false }))); setTasks((a) => a.map((x) => ({ ...x, on: false }))); router.refresh(); }
              })}>
              {pending ? "套用中…" : "套用到規劃（這次的決議與待辦）"}
            </button>
          </div>
        </>
      ) : <p className="muted">這場會議沒有對應的課程規劃，決議與待辦請手動記錄。</p>}
      {msg && <p className={`notice ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</p>}
    </section>
  );
}

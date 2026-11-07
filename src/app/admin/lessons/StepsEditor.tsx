"use client";

import { PHASES, type Phase, type Step } from "@/lib/lessons";

export const blankStep = (phase: Phase): Step => ({ phase, min: null, title: "", teacher: "", students: "" });

// 三段流程編輯器（前導引導／主要活動／分享收尾）：每段可加多個步驟、填分鐘數、上下移動
export default function StepsEditor({
  steps, setSteps,
}: {
  steps: Step[];
  setSteps: (fn: (all: Step[]) => Step[]) => void;
}) {
  const update = (i: number, patch: Partial<Step>) => setSteps((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) =>
    setSteps((all) => {
      const j = i + d;
      if (j < 0 || j >= all.length || all[j].phase !== all[i].phase) return all;
      const next = [...all];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const add = (phase: Phase) =>
    setSteps((all) => {
      // 插在同一段的最後面
      let at = all.length;
      for (let k = all.length - 1; k >= 0; k--) if (all[k].phase === phase) { at = k + 1; break; }
      if (at === all.length) {
        const order = PHASES.map((p) => p.value as Phase);
        at = all.findIndex((s) => order.indexOf(s.phase) > order.indexOf(phase));
        if (at < 0) at = all.length;
      }
      return [...all.slice(0, at), blankStep(phase), ...all.slice(at)];
    });

  return (
    <>
      {PHASES.map((p) => (
        <div key={p.value} className={`lsn-phase lsn-phase-${p.value}`}>
          <h3>{p.label} <small>{p.hint}</small></h3>
          {steps.map((s, i) =>
            s.phase !== p.value ? null : (
              <div key={i} className="lsn-step">
                <div className="lsn-step-top">
                  <input
                    type="number" min={1} max={480} placeholder="分" aria-label="分鐘" className="lsn-min"
                    value={s.min ?? ""} onChange={(e) => update(i, { min: e.target.value ? Number(e.target.value) : null })}
                  />
                  <input
                    placeholder="這一段在做什麼" aria-label="段落標題" maxLength={80}
                    value={s.title} onChange={(e) => update(i, { title: e.target.value })}
                  />
                  <span className="lsn-step-btns">
                    <button type="button" className="adm-link" onClick={() => move(i, -1)} aria-label="往上移">↑</button>
                    <button type="button" className="adm-link" onClick={() => move(i, 1)} aria-label="往下移">↓</button>
                    <button type="button" className="adm-link danger" onClick={() => setSteps((all) => all.filter((_, j) => j !== i))} aria-label="刪除這一段">✕</button>
                  </span>
                </div>
                <div className="lsn-step-body">
                  <textarea rows={2} placeholder="老師做什麼、說什麼、關鍵提問" aria-label="老師" value={s.teacher} onChange={(e) => update(i, { teacher: e.target.value })} />
                  <textarea rows={2} placeholder="孩子做什麼" aria-label="孩子" value={s.students} onChange={(e) => update(i, { students: e.target.value })} />
                </div>
              </div>
            ),
          )}
          <button type="button" className="adm-link" onClick={() => add(p.value)}>＋ 加一段{p.label}</button>
        </div>
      ))}
    </>
  );
}

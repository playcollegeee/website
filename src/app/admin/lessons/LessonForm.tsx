"use client";

import { useState } from "react";
import { LEVEL_NAME } from "@/lib/admin";
import {
  DIFFICULTY, MAJOR_SHORT, PHASES, TAG_KINDS,
  type Category, type Material, type Phase, type Step, type Tag,
} from "@/lib/lessons";
import { saveLesson } from "./actions";

export type LessonInit = {
  id?: string;
  title: string;
  category_id: string;
  levels: string[];
  difficulty: number | null;
  minutes: number;
  summary: string;
  goals: string;
  refs: string;
  steps: Step[];
  challenge: string;
  support: string;
  materials: Material[];
  tips: string;
  xp: number;
  status: string;
  tags: Tag[];
};

const LEVELS = Object.keys(LEVEL_NAME);
const MAJORS = ["lego", "3d", "art"];
const blankStep = (phase: Phase): Step => ({ phase, min: null, title: "", teacher: "", students: "" });

// 新增／編輯教案的表單（流程步驟、器材、標籤都在瀏覽器整理好，送出時變成 JSON 一起送）
export default function LessonForm({
  init, categories, tags,
}: {
  init: LessonInit;
  categories: Category[];
  tags: Tag[];
}) {
  const [categoryId, setCategoryId] = useState(init.category_id);
  const [levels, setLevels] = useState<string[]>(init.levels);
  const [steps, setSteps] = useState<Step[]>(init.steps.length ? init.steps : [blankStep("intro"), blankStep("main"), blankStep("wrap")]);
  const [materials, setMaterials] = useState<Material[]>(init.materials.length ? init.materials : [{ name: "", qty: "" }]);
  const [minutes, setMinutes] = useState(init.minutes);

  const total = steps.reduce((n, s) => n + (s.min ?? 0), 0);

  // 選了類別、還沒勾階段時，自動帶入類別的建議階段
  const pickCategory = (id: string) => {
    setCategoryId(id);
    const c = categories.find((x) => x.id === id);
    if (c && levels.length === 0) setLevels(c.levels);
  };

  const updateStep = (i: number, patch: Partial<Step>) =>
    setSteps((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const moveStep = (i: number, d: -1 | 1) =>
    setSteps((all) => {
      const j = i + d;
      if (j < 0 || j >= all.length || all[j].phase !== all[i].phase) return all;
      const next = [...all];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const addStep = (phase: Phase) =>
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
    <form action={saveLesson} className="adm-form lsn-form">
      {init.id && <input type="hidden" name="id" value={init.id} />}
      <input type="hidden" name="timeline" value={JSON.stringify(steps)} />
      <input type="hidden" name="materials" value={JSON.stringify(materials)} />

      <fieldset className="adm-panel">
        <legend>基本資料</legend>
        <div className="adm-grid">
          <div className="field adm-wide">
            <label htmlFor="l-title">教案標題 *</label>
            <input id="l-title" name="title" required maxLength={80} defaultValue={init.title} placeholder="例：齒輪傳動的變速小車" />
          </div>
          <div className="field">
            <label htmlFor="l-cat">課程類別 *</label>
            <select id="l-cat" name="category_id" required value={categoryId} onChange={(e) => pickCategory(e.target.value)}>
              <option value="" disabled>請選擇…</option>
              {MAJORS.map((m) => (
                <optgroup key={m} label={MAJOR_SHORT[m]}>
                  {categories.filter((c) => c.major === m && (c.active || c.id === init.category_id)).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{!c.active && "（已停用）"}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="l-min">時長（分鐘）</label>
            <input id="l-min" name="minutes" type="number" min={10} max={480} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="l-diff">難易度</label>
            <select id="l-diff" name="difficulty" defaultValue={init.difficulty ?? ""}>
              <option value="">未設定</option>
              {DIFFICULTY.map((d) => <option key={d} value={d}>{"★".repeat(d)}（{d}）</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="l-xp">出席經驗值</label>
            <input id="l-xp" name="xp" type="number" min={0} max={100} defaultValue={init.xp} />
            <small>孩子出席這堂課得到的角色經驗值，預設 10。</small>
          </div>
          <fieldset className="adm-levels adm-wide">
            <legend>適用階段</legend>
            {LEVELS.map((l) => (
              <label key={l} className="adm-check">
                <input
                  type="checkbox" name="levels" value={l} checked={levels.includes(l)}
                  onChange={(e) => setLevels((all) => (e.target.checked ? [...all, l] : all.filter((x) => x !== l)))}
                />
                {LEVEL_NAME[l]}
              </label>
            ))}
          </fieldset>
          <div className="field adm-wide">
            <label htmlFor="l-sum">一句話簡介</label>
            <input id="l-sum" name="summary" maxLength={200} defaultValue={init.summary} placeholder="例：用大小齒輪讓小車跑得更快，體驗變速的原理" />
          </div>
          <div className="field adm-wide">
            <label htmlFor="l-goals">學習目標</label>
            <textarea id="l-goals" name="goals" rows={3} defaultValue={init.goals} placeholder="孩子下課後能做到什麼（一行一個）" />
          </div>
        </div>
      </fieldset>

      <fieldset className="adm-panel">
        <legend>學習收穫與標籤</legend>
        <p className="hint">打字會提示既有標籤；按 Enter 或逗號加入。盡量選既有的標籤，搜尋與排課才找得到。</p>
        <div className="lsn-tagkinds">
          {TAG_KINDS.map((k) => (
            <TagInput
              key={k.value}
              kind={k.value}
              label={k.label}
              hint={k.hint}
              options={tags.filter((t) => t.kind === k.value).map((t) => t.name)}
              initial={init.tags.filter((t) => t.kind === k.value).map((t) => t.name)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="adm-panel">
        <legend>
          教學流程 <small className={total > minutes ? "lsn-over" : ""}>已排 {total}／{minutes} 分鐘</small>
        </legend>
        <div className="field">
          <label htmlFor="l-refs">前導引導的參考資料</label>
          <textarea id="l-refs" name="refs" rows={2} defaultValue={init.refs} placeholder="影片、圖片、繪本、網址（一行一個）" />
        </div>
        {PHASES.map((p) => (
          <div key={p.value} className={`lsn-phase lsn-phase-${p.value}`}>
            <h3>{p.label} <small>{p.hint}</small></h3>
            {steps.map((s, i) =>
              s.phase !== p.value ? null : (
                <div key={i} className="lsn-step">
                  <div className="lsn-step-top">
                    <input
                      type="number" min={1} max={480} placeholder="分" aria-label="分鐘" className="lsn-min"
                      value={s.min ?? ""} onChange={(e) => updateStep(i, { min: e.target.value ? Number(e.target.value) : null })}
                    />
                    <input
                      placeholder="這一段在做什麼（例：腳踏車為什麼要變速？）" aria-label="段落標題" maxLength={80}
                      value={s.title} onChange={(e) => updateStep(i, { title: e.target.value })}
                    />
                    <span className="lsn-step-btns">
                      <button type="button" className="adm-link" onClick={() => moveStep(i, -1)} aria-label="往上移">↑</button>
                      <button type="button" className="adm-link" onClick={() => moveStep(i, 1)} aria-label="往下移">↓</button>
                      <button type="button" className="adm-link danger" onClick={() => setSteps((all) => all.filter((_, j) => j !== i))} aria-label="刪除這一段">✕</button>
                    </span>
                  </div>
                  <div className="lsn-step-body">
                    <textarea rows={2} placeholder="老師做什麼、說什麼、關鍵提問" aria-label="老師" value={s.teacher} onChange={(e) => updateStep(i, { teacher: e.target.value })} />
                    <textarea rows={2} placeholder="孩子做什麼" aria-label="孩子" value={s.students} onChange={(e) => updateStep(i, { students: e.target.value })} />
                  </div>
                </div>
              ),
            )}
            <button type="button" className="adm-link" onClick={() => addStep(p.value)}>＋ 加一段{p.label}</button>
          </div>
        ))}
      </fieldset>

      <fieldset className="adm-panel">
        <legend>差異化</legend>
        <div className="adm-grid">
          <div className="field">
            <label htmlFor="l-ch">做得快的挑戰題</label>
            <textarea id="l-ch" name="challenge" rows={3} defaultValue={init.challenge} />
          </div>
          <div className="field">
            <label htmlFor="l-sp">需要協助時的簡化版</label>
            <textarea id="l-sp" name="support" rows={3} defaultValue={init.support} />
          </div>
        </div>
      </fieldset>

      <fieldset className="adm-panel">
        <legend>器材與材料</legend>
        {materials.map((m, i) => (
          <div key={i} className="adm-inline-form lsn-mat">
            <input
              placeholder="名稱（例：SPIKE Essential 套組）" aria-label="器材名稱" maxLength={80} value={m.name}
              onChange={(e) => setMaterials((all) => all.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <input
              placeholder="數量（例：每 2 人 1 盒）" aria-label="數量" maxLength={40} value={m.qty}
              onChange={(e) => setMaterials((all) => all.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
            />
            <button type="button" className="adm-link danger" onClick={() => setMaterials((all) => all.filter((_, j) => j !== i))} aria-label="刪除">✕</button>
          </div>
        ))}
        <button type="button" className="adm-link" onClick={() => setMaterials((all) => [...all, { name: "", qty: "" }])}>＋ 加一項器材</button>
      </fieldset>

      <fieldset className="adm-panel">
        <legend>常見卡關與解法</legend>
        <textarea name="tips" rows={4} defaultValue={init.tips} aria-label="常見卡關與解法" placeholder="孩子常卡在哪裡、怎麼引導（之後會從課後回饋累積）" className="lsn-full" />
      </fieldset>

      <fieldset className="adm-panel">
        <legend>狀態</legend>
        {init.status === "archived" ? (
          <>
            <input type="hidden" name="status" value="archived" />
            <p className="hint">這個教案已封存，儲存後仍是封存狀態；要恢復請到教案頁按「改回草稿」或「設為可使用」。</p>
          </>
        ) : (
          <div className="adm-radio">
            <label><input type="radio" name="status" value="draft" defaultChecked={init.status !== "ready"} /> 草稿（還在寫）</label>
            <label><input type="radio" name="status" value="ready" defaultChecked={init.status === "ready"} /> 可使用（其他老師可以排課）</label>
          </div>
        )}
      </fieldset>

      <button type="submit" className="btn primary">{init.id ? "儲存修改" : "建立教案"}</button>
    </form>
  );
}

// 標籤輸入：已選的顯示成小膠囊，打字時提示詞庫裡的標籤
function TagInput({
  kind, label, hint, options, initial,
}: {
  kind: string; label: string; hint: string; options: string[]; initial: string[];
}) {
  const [chosen, setChosen] = useState<string[]>(initial);
  const [text, setText] = useState("");
  const listId = `tags-${kind}`;

  const add = (raw: string) => {
    const v = raw.replace(/[,，、]/g, " ").replace(/\s+/g, " ").trim().slice(0, 30);
    if (v && !chosen.some((c) => c.toLowerCase() === v.toLowerCase())) {
      // 大小寫不同但其實是同一個既有標籤時，用詞庫的寫法
      const match = options.find((o) => o.toLowerCase() === v.toLowerCase());
      setChosen((all) => [...all, match ?? v]);
    }
    setText("");
  };

  return (
    <div className="field lsn-taginput">
      <label htmlFor={`ti-${kind}`}>{label}</label>
      <div className="lsn-chips">
        {chosen.map((c) => (
          <span key={c} className={`lsn-chip lsn-chip-${kind}`}>
            {c}
            {!options.includes(c) && <em title="詞庫裡還沒有，儲存時會新增">新</em>}
            <button type="button" onClick={() => setChosen((all) => all.filter((x) => x !== c))} aria-label={`移除 ${c}`}>✕</button>
            <input type="hidden" name={`tags_${kind}`} value={c} />
          </span>
        ))}
        <input
          id={`ti-${kind}`} list={listId} value={text} placeholder={hint}
          onChange={(e) => {
            const v = e.target.value;
            // 從提示清單點選時直接加入
            if (options.includes(v)) add(v);
            else if (/[,，、]$/.test(v)) add(v);
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && chosen.length) {
              setChosen((all) => all.slice(0, -1));
            }
          }}
          onBlur={() => text && add(text)}
        />
        <datalist id={listId}>
          {options.filter((o) => !chosen.includes(o)).map((o) => <option key={o} value={o} />)}
        </datalist>
      </div>
    </div>
  );
}

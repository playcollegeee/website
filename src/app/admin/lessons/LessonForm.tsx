"use client";

import { useState, useTransition } from "react";
import { LEVEL_NAME } from "@/lib/admin";
import {
  DIFFICULTY, MAJOR_SHORT, PHASES, TAG_KINDS,
  type Category, type Material, type Phase, type Step, type Tag,
} from "@/lib/lessons";
import { saveLesson } from "./actions";
import { draftLesson, type Draft } from "./aiActions";

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
  parent_note: string;
  outline: string;
  xp: number;
  status: string;
  tags: Tag[];
};

const LEVELS = Object.keys(LEVEL_NAME);
const MAJORS = ["lego", "3d", "art"];
const blankStep = (phase: Phase): Step => ({ phase, min: null, title: "", teacher: "", students: "" });

// 新增／編輯教案的表單（流程步驟、器材、標籤都在瀏覽器整理好，送出時變成 JSON 一起送）
export default function LessonForm({
  init, categories, tags, aiReady, hasPhoto,
}: {
  init: LessonInit;
  categories: Category[];
  tags: Tag[];
  aiReady: boolean;
  hasPhoto: boolean;
}) {
  // 文字欄位用 state 管理，AI 初稿才能直接填進來
  const [text, setText] = useState({
    title: init.title, summary: init.summary, goals: init.goals, refs: init.refs, challenge: init.challenge,
    support: init.support, tips: init.tips, parent_note: init.parent_note, outline: init.outline,
  });
  const T = (k: keyof typeof text) => ({
    value: text[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setText((t) => ({ ...t, [k]: e.target.value })),
  });
  const [chosenTags, setChosenTags] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(TAG_KINDS.map((k) => [k.value, init.tags.filter((t) => t.kind === k.value).map((t) => t.name)])),
  );
  const [tagKey, setTagKey] = useState(0);
  const [aiNotes, setAiNotes] = useState("");
  const [keep, setKeep] = useState(true);
  const [aiMsg, setAiMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiBusy, startAi] = useTransition();
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

  // 把 AI 初稿填進表單：keep=true 時只填空白的欄位
  function apply(d: Draft) {
    setText((t) => {
      const pick = (k: keyof typeof t, v: string) => (keep && t[k].trim() ? t[k] : v || t[k]);
      return {
        ...t,
        summary: pick("summary", d.summary), goals: pick("goals", d.goals), refs: pick("refs", d.refs),
        challenge: pick("challenge", d.challenge), support: pick("support", d.support),
        parent_note: pick("parent_note", d.parent_note), outline: pick("outline", d.outline),
      };
    });
    const hasSteps = steps.some((s) => s.title || s.teacher || s.students);
    if (d.steps.length && !(keep && hasSteps)) setSteps(d.steps);
    const hasMats = materials.some((m) => m.name);
    if (d.materials.length && !(keep && hasMats)) setMaterials(d.materials);
    // 標籤：合併（不刪老師已選的）
    setChosenTags((all) => {
      const next = { ...all };
      for (const [k, list] of Object.entries(d.tags)) {
        const have = next[k] ?? [];
        next[k] = [...have, ...list.filter((x) => !have.some((h) => h.toLowerCase() === x.toLowerCase()))];
      }
      return next;
    });
    setTagKey((n) => n + 1);
  }

  function runAi() {
    setAiMsg(null);
    startAi(async () => {
      const r = await draftLesson({ title: text.title, categoryId, levels, minutes, notes: aiNotes, lessonId: init.id });
      if (!r.ok) {
        setAiMsg({ ok: false, text: r.message });
        return;
      }
      apply(r.draft);
      setAiMsg({
        ok: true,
        text: `AI 初稿已填入${r.usedPhoto ? "（有參考成品照片）" : ""}。請逐段檢查：繪本書名是否真的存在、流程與時間是否合適、標籤是否正確，修改後再按儲存。`,
      });
    });
  }

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
            <input id="l-title" name="title" required maxLength={80} {...T("title")} placeholder="例：齒輪傳動的變速小車" />
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
            <input id="l-sum" name="summary" maxLength={200} {...T("summary")} placeholder="例：用大小齒輪讓小車跑得更快，體驗變速的原理" />
          </div>
          <div className="field adm-wide">
            <label htmlFor="l-goals">學習目標</label>
            <textarea id="l-goals" name="goals" rows={3} {...T("goals")} placeholder="孩子下課後能做到什麼（一行一個）" />
          </div>
        </div>
      </fieldset>

      <fieldset className="adm-panel lsn-ai">
        <legend>✨ AI 產生初稿</legend>
        {aiReady ? (
          <>
            <p className="hint">
              先填好上面的<strong>標題、類別、階段、時長</strong>，AI 會寫出學習目標、三段流程、差異化、器材、給家長的話、活動簡介與標籤，你再修改。
              {hasPhoto ? "會參考這個教案的封面照片。" : init.id ? "上傳成品照片後再產生，AI 會依照片描述結構。" : "建立教案、上傳成品照片後再用一次，AI 會依照片描述結構。"}
            </p>
            <div className="field">
              <label htmlFor="l-ai">給 AI 的補充（選填）</label>
              <textarea id="l-ai" rows={2} value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} maxLength={1500}
                placeholder="例：親子課 10 組；想用繪本《〇〇》；最後玩送貨遊戲；強調齒輪讓輪子轉更快" />
            </div>
            <div className="lsn-ai-row">
              <label className="adm-check">
                <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> 保留我已經寫的內容（只填空白的欄位）
              </label>
              <button type="button" className="btn btn-sm primary" onClick={runAi} disabled={aiBusy || !text.title.trim() || !categoryId}>
                {aiBusy ? "AI 撰寫中…（約 20–40 秒）" : "✨ 產生初稿"}
              </button>
            </div>
            {aiMsg && <p className={`notice ${aiMsg.ok ? "ok" : "err"}`} role="status">{aiMsg.text}</p>}
          </>
        ) : (
          <p className="hint">還沒設定 AI 金鑰（管理員到 Vercel 設定 ANTHROPIC_API_KEY 後就能使用）。</p>
        )}
      </fieldset>

      <fieldset className="adm-panel">
        <legend>學習收穫與標籤</legend>
        <p className="hint">打字會提示既有標籤；按 Enter 或逗號加入。盡量選既有的標籤，搜尋與排課才找得到。</p>
        <div className="lsn-tagkinds">
          {TAG_KINDS.map((k) => (
            <TagInput
              key={`${k.value}-${tagKey}`}
              kind={k.value}
              label={k.label}
              hint={k.hint}
              options={tags.filter((t) => t.kind === k.value).map((t) => t.name)}
              initial={chosenTags[k.value] ?? []}
              onChange={(list) => setChosenTags((all) => ({ ...all, [k.value]: list }))}
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
          <textarea id="l-refs" name="refs" rows={2} {...T("refs")} placeholder="影片、圖片、繪本、網址（一行一個）" />
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
            <textarea id="l-ch" name="challenge" rows={3} {...T("challenge")} />
          </div>
          <div className="field">
            <label htmlFor="l-sp">需要協助時的簡化版</label>
            <textarea id="l-sp" name="support" rows={3} {...T("support")} />
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
        <legend>對外文字 <small>匯出親子館、托育中心表格時使用</small></legend>
        <div className="field">
          <label htmlFor="l-parent">給家長的話</label>
          <textarea id="l-parent" name="parent_note" rows={3} maxLength={1000} {...T("parent_note")}
            placeholder="例：平時玩積木時，可以讓孩子盡量發揮，不用限制組裝方向，有困難再引導協助即可。" />
        </div>
        <div className="field">
          <label htmlFor="l-outline">活動簡介</label>
          <textarea id="l-outline" name="outline" rows={3} maxLength={1000} {...T("outline")}
            placeholder="對外宣傳、簡章用的一小段介紹，活潑有畫面" />
        </div>
      </fieldset>

      <fieldset className="adm-panel">
        <legend>常見卡關與解法</legend>
        <textarea name="tips" rows={4} {...T("tips")} aria-label="常見卡關與解法" placeholder="孩子常卡在哪裡、怎麼引導（之後會從課後回饋累積）" className="lsn-full" />
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
  kind, label, hint, options, initial, onChange,
}: {
  kind: string; label: string; hint: string; options: string[]; initial: string[]; onChange: (list: string[]) => void;
}) {
  const [chosen, setChosenRaw] = useState<string[]>(initial);
  // 每次變動都回報給表單（AI 套用標籤時要知道目前選了哪些）
  const setChosen = (fn: (all: string[]) => string[]) => {
    const next = fn(chosen);
    setChosenRaw(next);
    onChange(next);
  };
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

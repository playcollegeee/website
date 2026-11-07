"use client";

import { useState, useTransition } from "react";
import { LEVEL_NAME } from "@/lib/admin";
import { DIFFICULTY, MAJOR_SHORT, TAG_KINDS, type Category, type Material, type Tag } from "@/lib/lessons";
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
// 新增／編輯教案的表單：只放每堂課都用得到的欄位，讓老師好建立、好瀏覽。
// 學習目標、三段流程、給家長的話、活動簡介改在教案頁的「合作單位版」需要時才產生（CollabPack）。
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
    title: init.title, summary: init.summary, challenge: init.challenge, support: init.support, tips: init.tips,
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
  const [materials, setMaterials] = useState<Material[]>(init.materials.length ? init.materials : [{ name: "", qty: "" }]);
  const [minutes, setMinutes] = useState(init.minutes);

  // 選了類別、還沒勾階段時，自動帶入類別的建議階段
  const pickCategory = (id: string) => {
    setCategoryId(id);
    const c = categories.find((x) => x.id === id);
    if (c && levels.length === 0) setLevels(c.levels);
  };

  // 把 AI 初稿填進表單：keep=true 時只填空白的欄位
  function apply(d: Draft) {
    setText((t) => {
      const pick = (k: keyof typeof t, v: string) => (keep && t[k].trim() ? t[k] : v || t[k]);
      return {
        ...t,
        summary: pick("summary", d.summary), challenge: pick("challenge", d.challenge),
        support: pick("support", d.support), tips: pick("tips", d.tips),
      };
    });
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
        text: `AI 已幫忙填入${r.usedPhoto ? "（有參考成品照片）" : ""}。請檢查簡介、器材、標籤是否正確，修改後再按儲存。`,
      });
    });
  }

  return (
    <form action={saveLesson} className="adm-form lsn-form">
      {init.id && <input type="hidden" name="id" value={init.id} />}
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
        </div>
      </fieldset>

      <fieldset className="adm-panel lsn-ai">
        <legend>✨ AI 協助整理</legend>
        {aiReady ? (
          <>
            <p className="hint">
              填好<strong>標題、類別</strong>，可以把你的想法、上課筆記隨手貼在下面，AI 會整理出簡介、器材、挑戰題／簡化版、常見卡關，並建議標籤。
              {hasPhoto ? "會參考這個教案的封面照片。" : init.id ? "上傳成品照片後再用，AI 會依照片判斷結構。" : "建立教案、上傳成品照片後再用一次，結果會更準。"}
            </p>
            <div className="field">
              <label htmlFor="l-ai">你的想法或筆記（選填）</label>
              <textarea id="l-ai" rows={3} value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} maxLength={1500}
                placeholder="例：用 SPIKE 做變速小車，大齒輪帶小齒輪跑比較快；孩子常把齒輪裝太緊轉不動；做得快的可以加後輪避震" />
            </div>
            <div className="lsn-ai-row">
              <label className="adm-check">
                <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> 保留我已經寫的內容（只填空白的欄位）
              </label>
              <button type="button" className="btn btn-sm primary" onClick={runAi} disabled={aiBusy || !text.title.trim() || !categoryId}>
                {aiBusy ? "AI 整理中…（約 20–40 秒）" : "✨ 協助整理"}
              </button>
            </div>
            {aiMsg && <p className={`notice ${aiMsg.ok ? "ok" : "err"}`} role="status">{aiMsg.text}</p>}
          </>
        ) : (
          <p className="hint">還沒設定 AI 金鑰（管理員到 Vercel 設定 ANTHROPIC_API_KEY 後就能使用）。</p>
        )}
      </fieldset>

      <fieldset className="adm-panel">
        <legend>分類標籤</legend>
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

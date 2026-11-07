"use client";

import { useState, useTransition } from "react";
import { LEVEL_NAME } from "@/lib/admin";
import {
  DIFFICULTY, MAJOR_SHORT, NOTE_KINDS, PRESET_KIND_LABEL, TAG_KINDS, noteAuthor,
  type Category, type LessonNote, type Material, type MaterialPreset, type NoteKind, type Tag,
} from "@/lib/lessons";
import { saveLesson } from "./actions";
import { suggestRefs, type Organize, type Suggestion } from "./aiActions";

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
  xp: number;
  status: string;
  tags: Tag[];
  notes?: LessonNote[]; // 編輯時顯示已經有的參考資料、參考進行活動、課程遇到的問題（唯讀）
};

const LEVELS = Object.keys(LEVEL_NAME);
const MAJORS = ["lego", "3d", "art"];
// 新增／編輯教案的表單：只放每堂課都用得到的欄位，讓老師好建立、好瀏覽。
// 學習目標、三段流程、給家長的話、活動簡介改在教案頁的「合作單位教案生成」需要時才產生（CollabPack）。
export default function LessonForm({
  init, categories, tags, presets, aiReady, hasPhoto,
}: {
  init: LessonInit;
  categories: Category[];
  tags: Tag[];
  presets: MaterialPreset[];
  aiReady: boolean;
  hasPhoto: boolean;
}) {
  // 文字欄位用 state 管理，AI 初稿才能直接填進來
  const [text, setText] = useState({
    title: init.title, summary: init.summary, challenge: init.challenge, support: init.support,
  });
  const T = (k: keyof typeof text) => ({
    value: text[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setText((t) => ({ ...t, [k]: e.target.value })),
  });
  const [chosenTags, setChosenTags] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(TAG_KINDS.map((k) => [k.value, init.tags.filter((t) => t.kind === k.value).map((t) => t.name)])),
  );
  const [aiNotes, setAiNotes] = useState("");
  const [aiMsg, setAiMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sugg, setSugg] = useState<Record<NoteKind, Suggestion[]> | null>(null);
  const [org, setOrg] = useState<Organize | null>(null);
  const [tagKey, setTagKey] = useState(0);
  const [added, setAdded] = useState<string[]>([]); // 已加入的候選（用 kind+title 記）
  const [noteText, setNoteText] = useState<Record<NoteKind, string>>({ ref: "", activity: "" });
  const [issues, setIssues] = useState<string[]>([""]);
  const [aiBusy, startAi] = useTransition();
  const [categoryId, setCategoryId] = useState(init.category_id);
  const [levels, setLevels] = useState<string[]>(init.levels);
  const [materials, setMaterials] = useState<Material[]>(init.materials.length ? init.materials : [{ name: "", qty: "" }]);
  // 點選盒組：已經有就不重複，有空白列就填進空白列
  const addPreset = (name: string) =>
    setMaterials((all) => {
      if (all.some((m) => m.name.trim() === name)) return all;
      const blank = all.findIndex((m) => !m.name.trim() && !m.qty.trim());
      return blank >= 0 ? all.map((m, i) => (i === blank ? { name, qty: "" } : m)) : [...all, { name, qty: "" }];
    });
  const [minutes, setMinutes] = useState(init.minutes);

  // 選了類別、還沒勾階段時，自動帶入類別的建議階段
  const pickCategory = (id: string) => {
    setCategoryId(id);
    const c = categories.find((x) => x.id === id);
    if (c && levels.length === 0) setLevels(c.levels);
  };

  // AI 協助查詢參考資料與參考進行活動：只列候選，老師點「加入」才放進欄位，按儲存才存
  function runAi() {
    setAiMsg(null);
    startAi(async () => {
      const r = await suggestRefs({ title: text.title, categoryId, levels, minutes, notes: aiNotes, lessonId: init.id });
      if (!r.ok) {
        setAiMsg({ ok: false, text: r.message });
        return;
      }
      setSugg({ ref: r.refs, activity: r.activities });
      setOrg(r.organize);
      setAdded([]);
      setAiMsg({
        ok: true,
        text: `整理好了${r.usedPhoto ? "（有參考成品照片）" : ""}：下面是整理建議、${r.refs.length} 個參考資料與 ${r.activities.length} 個活動點子。按「套用」或「加入」才會放進表單，可以再修改；繪本書名請先確認真的存在。`,
      });
    });
  }
  // 套用整理建議（都是合併或填入，不會刪掉老師已寫的；文字欄位 onlyBlank 時只填空白）
  const applyOrg = (part: "summary" | "challenge" | "support" | "materials" | "issues" | "tags", onlyBlank = false) => {
    if (!org) return;
    if (part === "summary" || part === "challenge" || part === "support") {
      if (!org[part]) return;
      setText((t) => (onlyBlank && t[part].trim() ? t : { ...t, [part]: org[part] }));
    } else if (part === "materials") {
      org.materials.forEach((m) =>
        setMaterials((all) => {
          if (all.some((x) => x.name.trim() === m.name)) return all;
          const blank = all.findIndex((x) => !x.name.trim() && !x.qty.trim());
          return blank >= 0 ? all.map((x, i) => (i === blank ? m : x)) : [...all, m];
        }),
      );
    } else if (part === "issues") {
      setIssues((all) => {
        const have = all.map((x) => x.trim()).filter(Boolean);
        const more = org.issues.filter((x) => !have.includes(x));
        return [...have, ...more].length ? [...have, ...more] : [""];
      });
    } else {
      setChosenTags((all) => {
        const next = { ...all };
        for (const [k, list] of Object.entries(org.tags)) {
          const have = next[k] ?? [];
          next[k] = [...have, ...list.filter((x) => !have.some((h) => h.toLowerCase() === x.toLowerCase()))];
        }
        return next;
      });
      setTagKey((n) => n + 1);
    }
    setAdded((a) => [...a, "org-" + part]);
  };
  const applyAll = () => (["summary", "challenge", "support", "materials", "issues", "tags"] as const).forEach((p) => applyOrg(p, true));
  const haveIssues = (init.notes ?? []).filter((n) => n.kind === "issue");
  const take = (kind: NoteKind, x: Suggestion) => {
    setNoteText((t) => ({ ...t, [kind]: (t[kind].trim() ? t[kind].trimEnd() + "\n" : "") + `${x.title}：${x.detail}` }));
    setAdded((a) => [...a, kind + x.title]);
  };

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
        <legend>✨ AI 協助查詢與整理</legend>
        {aiReady ? (
          <>
            <p className="hint">
              填好<strong>標題、類別</strong>，可以把你的想法、上課筆記貼在下面。AI 會整理簡介、器材、差異化、可能遇到的問題、標籤，並查詢參考資料與活動點子。
              結果會先列出來，你按「套用」或「加入」才會放進表單，不會直接存。{hasPhoto ? "會參考這個教案的封面照片。" : ""}
            </p>
            <textarea value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} maxLength={1500} rows={3} className="lsn-full"
              placeholder="你的想法、筆記或想找的方向（選填）：例如 用齒輪讓鱷魚嘴巴開合；想要有繪本；最後玩分組餵食遊戲" aria-label="想法或筆記" />
            <div className="lsn-ai-row">
              <button type="button" className="btn btn-sm primary" onClick={runAi} disabled={aiBusy || !text.title.trim() || !categoryId}>
                {aiBusy ? "AI 查詢整理中…（約 20–40 秒）" : "✨ 協助查詢與整理"}
              </button>
            </div>
            {aiMsg && <p className={`notice ${aiMsg.ok ? "ok" : "err"}`} role="status">{aiMsg.text}</p>}
            {org && (
              <div className="lsn-org">
                <div className="lsn-org-head">
                  <h4>📝 整理建議</h4>
                  <button type="button" className="btn btn-sm" onClick={applyAll}>全部套用（文字只填空白欄位）</button>
                </div>
                <ul>
                  {([
                    ["summary", "一句話簡介", org.summary],
                    ["challenge", "做得快的挑戰題", org.challenge],
                    ["support", "需要協助時的簡化版", org.support],
                    ["materials", "器材與材料", org.materials.map((m) => m.name + (m.qty ? `（${m.qty}）` : "")).join("、")],
                    ["issues", "可能遇到的問題", org.issues.map((x) => "• " + x).join("\n")],
                    ["tags", "標籤", TAG_KINDS.filter((k) => org.tags[k.value]?.length).map((k) => `${k.label}：${org.tags[k.value].join("、")}`).join("　")],
                  ] as const).filter(([, , v]) => v).map(([part, label, v]) => {
                    const done = added.includes("org-" + part);
                    return (
                      <li key={part}>
                        <div><strong>{label}</strong><p className="lsn-pre">{v}</p></div>
                        <button type="button" className="btn btn-sm" disabled={done} onClick={() => applyOrg(part)}>
                          {done ? "✓ 已套用" : part === "summary" || part === "challenge" || part === "support" ? "套用" : "＋ 加入"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {sugg && (
              <div className="lsn-sugg">
                {NOTE_KINDS.map((k) => (
                  <div key={k.value}>
                    <h4>{k.icon} {k.label}</h4>
                    {sugg[k.value].length === 0 && <p className="muted">沒有建議。</p>}
                    <ul>
                      {sugg[k.value].map((x, i) => {
                        const done = added.includes(k.value + x.title);
                        return (
                          <li key={i}>
                            <div><strong>{x.title}</strong><p>{x.detail}</p></div>
                            <button type="button" className="btn btn-sm" disabled={done} onClick={() => take(k.value, x)}>
                              {done ? "✓ 已加入" : "＋ 加入"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
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
        <legend>參考資料與參考進行活動</legend>
        <p className="hint">
          {init.id
            ? "下面可以再新增；已經有的內容（含其他老師分享的）在教案頁查看，自己寫的可以在教案頁編輯。"
            : "選填。建立後也可以在教案頁繼續新增，其他老師也能分享自己的做法。"}
        </p>
        {NOTE_KINDS.map((k) => {
          const have = (init.notes ?? []).filter((n) => n.kind === k.value);
          return (
            <div key={k.value} className="field">
              <label htmlFor={`l-note-${k.value}`}>
                {k.icon} {k.label} <small>{k.hint}{have.length ? `・目前已有 ${have.length} 筆` : ""}</small>
              </label>
              {have.length > 0 && (
                <ul className="lsn-note-peek">
                  {have.slice(0, 3).map((n) => (
                    <li key={n.id}><span>{n.body.split("\n")[0].slice(0, 60)}</span><small className="muted">　{noteAuthor(n)}</small></li>
                  ))}
                  {have.length > 3 && <li className="muted">…還有 {have.length - 3} 筆</li>}
                </ul>
              )}
              <textarea
                id={`l-note-${k.value}`} name={`note_${k.value}`} rows={k.value === "activity" ? 4 : 3} maxLength={3000}
                value={noteText[k.value]} onChange={(e) => setNoteText((t) => ({ ...t, [k.value]: e.target.value }))}
                placeholder={k.placeholder + "（網址可以直接貼，一行一個）"} className="lsn-full"
              />
            </div>
          );
        })}

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
        {presets.length > 0 && (
          <div className="lsn-presets">
            <span className="hint">點選加入：</span>
            {presets.map((p) => {
              const on = materials.some((m) => m.name.trim() === p.name);
              return (
                <button key={p.id} type="button" className={`lsn-preset${on ? " on" : ""}${p.kind === "kit" ? " kit" : ""}`}
                  onClick={() => addPreset(p.name)} disabled={on} title={PRESET_KIND_LABEL[p.kind]}>
                  {on ? "✓ " : p.kind === "kit" ? "📦 " : "＋ "}{p.name}
                </button>
              );
            })}
          </div>
        )}
        {materials.map((m, i) => (
          <div key={i} className="adm-inline-form lsn-mat">
            <input
              placeholder="名稱（也可以直接打，例：毛根、色紙）" aria-label="器材名稱" maxLength={80} value={m.name}
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
        <legend>課程遇到的問題</legend>
        <p className="hint">一行寫一個問題（孩子卡在哪、器材狀況、時間不夠…）。會顯示是誰寫的，其他老師可以在教案頁留備註回饋解法。</p>
        {haveIssues.length > 0 && (
          <ul className="lsn-note-peek">
            {haveIssues.map((n) => (
              <li key={n.id}><span>• {n.body.split("\n")[0].slice(0, 80)}</span><small className="muted">　{noteAuthor(n)}</small></li>
            ))}
          </ul>
        )}
        {issues.map((v, i) => (
          <div key={i} className="adm-inline-form lsn-mat">
            <input
              value={v} maxLength={500} aria-label={`問題 ${i + 1}`}
              placeholder={i === 0 ? "例：小肌肉還不夠力，鱷魚嘴巴的軸常常插不進去" : "再寫一個問題"}
              onChange={(e) => setIssues((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); setIssues((all) => [...all.slice(0, i + 1), "", ...all.slice(i + 1)]); }
              }}
            />
            <button type="button" className="adm-link danger" aria-label="刪除"
              onClick={() => setIssues((all) => (all.length > 1 ? all.filter((_, j) => j !== i) : [""]))}>✕</button>
          </div>
        ))}
        <button type="button" className="adm-link" onClick={() => setIssues((all) => [...all, ""])}>＋ 再加一個問題</button>
        <input type="hidden" name="issues" value={JSON.stringify(issues.map((x) => x.trim()).filter(Boolean))} />
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

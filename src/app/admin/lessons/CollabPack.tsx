"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PHASES, type Step } from "@/lib/lessons";
import { EXPORT_FORMATS } from "@/lib/lessonExport";
import { saveCollab } from "./actions";
import { draftCollab, type Collab } from "./aiActions";
import StepsEditor, { blankStep } from "./StepsEditor";
import Text from "./LessonText";

const has = (c: Collab) => !!(c.goals.trim() || c.refs.trim() || c.steps.length || c.parent_note.trim() || c.outline.trim());
const emptySteps = (): Step[] => [blankStep("intro"), blankStep("main"), blankStep("wrap")];

// 合作單位版（親子館、幼兒園用）：學習目標、三段流程、給家長的話、活動簡介。
// 平常的教案不需要，所以放在教案頁，需要時再請 AI 產生、老師修改後儲存，也從這裡匯出 Word。
export default function CollabPack({
  lessonId, minutes, init, aiReady, hasPhoto,
}: {
  lessonId: string;
  minutes: number;
  init: Collab;
  aiReady: boolean;
  hasPhoto: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<Collab>(init);
  const [draft, setDraft] = useState<Collab | null>(null); // 有值＝編輯中
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiBusy, startAi] = useTransition();
  const [saving, startSave] = useTransition();
  const filled = has(saved);

  function generate() {
    if (filled && !draft && !confirm("重新產生會取代目前的合作單位版內容（儲存前都可以取消），確定嗎？")) return;
    setMsg(null);
    startAi(async () => {
      const r = await draftCollab({ lessonId, notes });
      if (!r.ok) {
        setMsg({ ok: false, text: r.message });
        return;
      }
      setDraft({ ...r.collab, steps: r.collab.steps.length ? r.collab.steps : emptySteps() });
      setMsg({
        ok: true,
        text: `AI 已產生${r.usedPhoto ? "（有參考成品照片）" : ""}。請檢查繪本書名是否真的存在、流程時間是否合適，修改後按「儲存」。`,
      });
    });
  }

  function save() {
    if (!draft) return;
    const fd = new FormData();
    fd.set("id", lessonId);
    fd.set("goals", draft.goals);
    fd.set("refs", draft.refs);
    fd.set("timeline", JSON.stringify(draft.steps));
    fd.set("parent_note", draft.parent_note);
    fd.set("outline", draft.outline);
    startSave(async () => {
      const r = await saveCollab(fd);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) {
        setSaved({ ...draft, steps: draft.steps.filter((s) => s.title || s.teacher || s.students) });
        setDraft(null);
        router.refresh();
      }
    });
  }

  const set = (k: "goals" | "refs" | "parent_note" | "outline") => ({
    value: draft?.[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft((d) => (d ? { ...d, [k]: e.target.value } : d)),
  });

  // ---------- 編輯中 ----------
  if (draft) {
    const total = draft.steps.reduce((n, s) => n + (s.min ?? 0), 0);
    return (
      <section className="adm-panel lsn-collab lsn-noprint">
        <h2>🤝 合作單位版 <small>編輯中</small></h2>
        {msg && <p className={`notice ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</p>}
        <div className="adm-form">
          <div className="field">
            <label htmlFor="c-goals">學習目標</label>
            <textarea id="c-goals" rows={3} maxLength={2000} {...set("goals")} placeholder="孩子下課後能做到什麼（一行一個）" />
          </div>
          <div className="field">
            <label htmlFor="c-refs">前導引導的參考資料</label>
            <textarea id="c-refs" rows={2} maxLength={3000} {...set("refs")} placeholder="繪本、影片、圖片、網址（一行一個）" />
          </div>
          <h3 className="lsn-sub">
            教學流程 <small className={total > minutes ? "lsn-over" : ""}>已排 {total}／{minutes} 分鐘</small>
          </h3>
          <StepsEditor steps={draft.steps} setSteps={(fn) => setDraft((d) => (d ? { ...d, steps: fn(d.steps) } : d))} />
          <div className="field">
            <label htmlFor="c-parent">給家長的話</label>
            <textarea id="c-parent" rows={3} maxLength={1000} {...set("parent_note")} />
          </div>
          <div className="field">
            <label htmlFor="c-outline">活動簡介 <small>對外宣傳、簡章用</small></label>
            <textarea id="c-outline" rows={3} maxLength={1000} {...set("outline")} />
          </div>
          <div className="adm-btns">
            <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? "儲存中…" : "儲存"}</button>
            <button type="button" className="btn" onClick={() => { setDraft(null); setMsg(null); }} disabled={saving}>取消</button>
          </div>
        </div>
      </section>
    );
  }

  // ---------- 產生區（還沒有內容，或要重新產生） ----------
  const generator = aiReady ? (
    <div className="lsn-collab-gen lsn-noprint">
      <div className="field">
        <label htmlFor="c-notes">這次的補充（選填）</label>
        <textarea id="c-notes" rows={2} maxLength={1500} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="例：親子課 10 組、60 分鐘；想用繪本《〇〇》；最後玩送貨遊戲" />
      </div>
      <div className="adm-btns">
        <button type="button" className="btn btn-sm primary" onClick={generate} disabled={aiBusy}>
          {aiBusy ? "AI 撰寫中…（約 20–40 秒）" : filled ? "✨ 重新產生" : "✨ 產生合作單位版"}
        </button>
        {!filled && (
          <button type="button" className="btn btn-sm" onClick={() => setDraft({ ...saved, steps: emptySteps() })} disabled={aiBusy}>
            自己寫
          </button>
        )}
      </div>
      {!hasPhoto && <p className="hint">上傳成品照片後再產生，AI 會依照片描述作品結構。</p>}
    </div>
  ) : (
    <p className="hint lsn-noprint">還沒設定 AI 金鑰（管理員到 Vercel 設定 ANTHROPIC_API_KEY 後就能使用）。</p>
  );

  if (!filled) {
    return (
      <section className="adm-panel lsn-collab lsn-noprint">
        <h2>🤝 合作單位版 <small>親子館、幼兒園需要時再產生</small></h2>
        <p className="hint">
          學習目標、三段教學流程（前導引導／主要活動／分享收尾）、給家長的話、活動簡介。
          AI 會依這個教案的內容先寫一份，你修改後儲存，就能匯出 Word 表格交給合作單位。
        </p>
        {generator}
        {msg && <p className={`notice ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</p>}
      </section>
    );
  }

  // ---------- 已有內容：顯示 ----------
  const total = saved.steps.reduce((n, s) => n + (s.min ?? 0), 0);
  return (
    <section className="adm-panel lsn-collab">
      <div className="lsn-collab-head">
        <h2>🤝 合作單位版</h2>
        <div className="adm-actions lsn-noprint">
          <details className="adm-pop lsn-export">
            <summary className="btn btn-sm">📄 匯出 Word</summary>
            <ul>
              {(Object.keys(EXPORT_FORMATS) as (keyof typeof EXPORT_FORMATS)[]).map((f) => (
                <li key={f}>
                  <a href={`/admin/lessons/${lessonId}/export/${f}`}>{EXPORT_FORMATS[f].label}</a>
                  <small>{EXPORT_FORMATS[f].hint}</small>
                </li>
              ))}
            </ul>
          </details>
          <button type="button" className="btn btn-sm" onClick={() => { setMsg(null); setDraft({ ...saved, steps: saved.steps.length ? saved.steps : emptySteps() }); }}>
            編輯
          </button>
        </div>
      </div>
      {msg && <p className={`notice ${msg.ok ? "ok" : "err"} lsn-noprint`} role="status">{msg.text}</p>}

      <h3 className="lsn-sub">學習目標</h3>
      <Text v={saved.goals || null} />

      <h3 className="lsn-sub">教學流程 <small>共 {total || "—"} 分鐘</small></h3>
      {saved.refs && (
        <div className="lsn-refs">
          <strong>前導引導的參考資料</strong>
          <Text v={saved.refs} />
        </div>
      )}
      {PHASES.map((p) => {
        const ps = saved.steps.filter((s) => s.phase === p.value);
        if (!ps.length) return null;
        return (
          <div key={p.value} className={`lsn-phase lsn-phase-${p.value}`}>
            <h3>{p.label}</h3>
            <ol className="lsn-timeline">
              {ps.map((s, i) => (
                <li key={i}>
                  <span className="lsn-min-badge">{s.min ? `${s.min} 分` : "—"}</span>
                  <div>
                    {s.title && <strong>{s.title}</strong>}
                    {s.teacher && <div className="lsn-who"><em>老師</em><Text v={s.teacher} /></div>}
                    {s.students && <div className="lsn-who"><em>孩子</em><Text v={s.students} /></div>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        );
      })}

      <h3 className="lsn-sub">給家長的話</h3>
      <Text v={saved.parent_note || null} />
      <h3 className="lsn-sub">活動簡介</h3>
      <Text v={saved.outline || null} />

      <details className="lsn-collab-redo lsn-noprint">
        <summary>✨ 用 AI 重新產生</summary>
        {generator}
      </details>
    </section>
  );
}

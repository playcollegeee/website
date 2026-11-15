"use client";

import { useState, useTransition } from "react";
import { shrinkImage } from "@/lib/imageShrink";
import { DEFAULT_DAY_FLOW, DEFAULT_FAQ, MENU_MODE_LABEL, isPending, type CampSeason, type FaqItem, type FlowStep, type MenuMode } from "@/lib/campTypes";
import { saveSeason } from "../actions";

// 後台：一季的頁面內容（首屏、頂端選單、早鳥、一天流程、Q&A、要帶什麼、接送）
export default function SeasonForm({ season: s }: { season: CampSeason }) {
  const [menu, setMenu] = useState<MenuMode>(s.menu_mode);
  const [flow, setFlow] = useState<FlowStep[]>(s.day_flow.length ? s.day_flow : DEFAULT_DAY_FLOW);
  const [faq, setFaq] = useState<FaqItem[]>(s.faq.length ? s.faq : DEFAULT_FAQ);
  const [img, setImg] = useState<{ blob: Blob; width: number; height: number; url: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const out = await shrinkImage(f, 1600);
      setImg({ ...out, url: URL.createObjectURL(out.blob) });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "照片處理失敗" });
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("picker");
    fd.set("day_flow", JSON.stringify(flow));
    fd.set("faq", JSON.stringify(faq));
    if (img) {
      fd.set("file", img.blob, `cover.${img.blob.type === "image/webp" ? "webp" : "jpg"}`);
      fd.set("width", String(img.width));
      fd.set("height", String(img.height));
    }
    start(async () => {
      const r = await saveSeason(fd);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) setImg(null);
    });
  }

  const setF = (i: number, patch: Partial<FlowStep>) => setFlow((l) => l.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const setQ = (i: number, patch: Partial<FaqItem>) => setFaq((l) => l.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const moveQ = (i: number, d: -1 | 1) =>
    setFaq((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const c = [...l];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const cover = img?.url ?? s.cover_url ?? undefined;

  return (
    <form onSubmit={submit} className="cmp-form" aria-busy={busy}>
      <input type="hidden" name="id" value={s.id} />

      <fieldset className="adm-panel">
        <legend>① 首屏</legend>
        <div className="cmp-grid">
          <label className="ph-img cmp-cover">
            {cover ? <img src={cover} alt="" /> : <span className="ph-empty">＋ 首屏主視覺照片（可不放，會用營隊封面）</span>}
            <span className="ph-img-btn">{cover ? "更換照片" : "選擇照片"}</span>
            <input type="file" name="picker" accept="image/*" onChange={pick} className="sr-only" />
          </label>
          <div className="ph-fields">
            <label className="ph-wide">
              標題
              <input name="title" defaultValue={s.title} maxLength={40} required />
            </label>
            <label className="ph-wide">
              大標下的一句話
              <input name="headline" defaultValue={s.headline} maxLength={60} placeholder="例：這個寒假，一起動手玩出超能力" />
            </label>
            <label className="ph-wide">
              介紹（寫給家長：這季的主題、孩子會得到什麼）
              <textarea name="intro" defaultValue={s.intro} rows={4} maxLength={800} />
            </label>
          </div>
        </div>
      </fieldset>

      <fieldset className="adm-panel">
        <legend>② 頂端選單與早鳥</legend>
        <div className="ph-fields">
          <label className="ph-wide">
            頂端選單的「{s.season === "winter" ? "❄️ 冬令營" : "☀️ 夏令營"}」入口
            <select name="menu_mode" value={menu} onChange={(e) => setMenu(e.target.value as MenuMode)}>
              {Object.entries(MENU_MODE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          {menu === "auto" && (
            <label>
              開始宣傳的日期
              <input type="date" name="promo_from" defaultValue={s.promo_from ?? ""} required />
            </label>
          )}
          {menu !== "auto" && <input type="hidden" name="promo_from" value={s.promo_from ?? ""} />}
          <label>
            早鳥截止日（可不填）
            <input type="date" name="early_until" defaultValue={s.early_until ?? ""} />
          </label>
          <label className="ph-wide">
            早鳥說明（不寫金額，例：12/15 前完成報名享早鳥優惠，詳見報名頁）
            <input name="early_text" defaultValue={s.early_text ?? ""} maxLength={80} />
          </label>
          <p className="hint ph-wide">頁面只在發布後才會出現在選單。早鳥的折扣請在「活動報名」的方案裡設定（例如加一個「早鳥」方案）。</p>
        </div>
      </fieldset>

      <fieldset className="adm-panel">
        <legend>③ 一天的流程</legend>
        <div className="cmp-rows">
          {flow.map((f, i) => (
            <div key={i} className="cmp-row">
              <input aria-label="時間" value={f.time} onChange={(e) => setF(i, { time: e.target.value })} maxLength={10} placeholder="09:30" className="cmp-time" />
              <input aria-label="項目" value={f.title} onChange={(e) => setF(i, { title: e.target.value })} maxLength={30} placeholder="上午課程" />
              <input aria-label="說明" value={f.note ?? ""} onChange={(e) => setF(i, { note: e.target.value })} maxLength={80} placeholder="說明（可不填）" className="cmp-grow" />
              <button type="button" className="adm-link danger" onClick={() => setFlow((l) => l.filter((_, k) => k !== i))} aria-label="刪除這一列">✕</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-sm" onClick={() => setFlow((l) => [...l, { time: "", title: "", note: "" }])}>＋ 加一列</button>
      </fieldset>

      <fieldset className="adm-panel">
        <legend>④ 家長 Q&A</legend>
        <p className="hint">寫著【待填】的題目不會出現在官網。分類一樣的會放在一起（例：報名、課程、生活）。</p>
        <div className="cmp-faq">
          {faq.map((f, i) => (
            <div key={i} className={`cmp-faq-item ${isPending(f.a) ? "pending" : ""}`}>
              <div className="cmp-row">
                <input aria-label="分類" value={f.cat} onChange={(e) => setQ(i, { cat: e.target.value })} maxLength={10} className="cmp-time" />
                <input aria-label="問題" value={f.q} onChange={(e) => setQ(i, { q: e.target.value })} maxLength={120} className="cmp-grow" placeholder="問題" />
                <button type="button" className="btn btn-sm" onClick={() => moveQ(i, -1)} disabled={i === 0} aria-label="往上">↑</button>
                <button type="button" className="btn btn-sm" onClick={() => moveQ(i, 1)} disabled={i === faq.length - 1} aria-label="往下">↓</button>
                <button type="button" className="adm-link danger" onClick={() => setFaq((l) => l.filter((_, k) => k !== i))} aria-label="刪除這一題">✕</button>
              </div>
              <textarea aria-label="回答" value={f.a} onChange={(e) => setQ(i, { a: e.target.value })} rows={2} maxLength={800} placeholder="回答" />
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-sm" onClick={() => setFaq((l) => [...l, { cat: "其他", q: "", a: "" }])}>＋ 加一題</button>
      </fieldset>

      <fieldset className="adm-panel">
        <legend>⑤ 準備與接送</legend>
        <div className="ph-fields">
          <label>
            要帶什麼（一行一項）
            <textarea name="bring" defaultValue={s.bring} rows={5} maxLength={1000} />
          </label>
          <label className={isPending(s.pickup) ? "cmp-pending" : ""}>
            地點與接送說明
            <textarea name="pickup" defaultValue={s.pickup} rows={5} maxLength={600} />
          </label>
        </div>
      </fieldset>

      <div className="ph-actions cmp-save">
        <button type="submit" className="btn primary" disabled={busy}>{busy ? "儲存中…" : "儲存頁面內容"}</button>
        {img && <span className="hint">新照片按儲存才會上傳</span>}
        {msg && <span className={`ph-msg ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</span>}
      </div>
    </form>
  );
}

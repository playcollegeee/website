"use client";

import { useRef, useState, useTransition } from "react";
import { shrinkImage } from "@/lib/imageShrink";
import { GRADES, SHOWCASE_LABEL, type Theme, type ThemePhoto } from "@/lib/eventTypes";
import ActBtn from "../ActBtn";
import RichTextarea from "../RichTextarea";
import { addThemePhoto, clearThemeFlow, deleteTheme, setThemeFlow, deleteThemePhoto, moveThemePhoto, saveTheme, setThemeCover, type EvResult } from "../actions";

// 後台：一個主題的介紹＋照片管理（照片在瀏覽器縮到 1600px 再一張一張上傳）
export default function ThemeEditor({ theme, activities, photos }: { theme?: Theme; activities: { id: string; title: string }[]; photos: ThemePhoto[] }) {
  const t = theme;
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(!t);
  const [msg, setMsg] = useState<EvResult | null>(null);
  const [busy, start] = useTransition();
  const [uploading, setUploading] = useState("");
  const [flowBusy, setFlowBusy] = useState(false);

  async function uploadFlow(files: FileList | null) {
    const f = files?.[0];
    if (!f || !t) return;
    setFlowBusy(true);
    try {
      // 流程圖字多，長邊保留 2000px 比較清楚
      const out = await shrinkImage(f, 2000, 0.9);
      const fd = new FormData();
      fd.set("theme_id", t.id);
      fd.set("file", out.blob, "flow.webp");
      fd.set("width", String(out.width));
      fd.set("height", String(out.height));
      setMsg(await setThemeFlow(fd));
    } catch (err) {
      setMsg({ ok: false, message: err instanceof Error ? err.message : "圖片處理失敗" });
    }
    setFlowBusy(false);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await saveTheme(fd);
      setMsg(r);
      if (r.ok && !t) formRef.current?.reset();
    });
  }

  async function upload(files: FileList | null) {
    if (!files || !t) return;
    const list = [...files];
    for (let i = 0; i < list.length; i++) {
      setUploading(`上傳中 ${i + 1}/${list.length}…`);
      try {
        const out = await shrinkImage(list[i], 1600);
        const fd = new FormData();
        fd.set("theme_id", t.id);
        fd.set("file", out.blob, "photo.webp");
        fd.set("width", String(out.width));
        fd.set("height", String(out.height));
        const r = await addThemePhoto(fd);
        if (!r.ok) {
          setMsg(r);
          break;
        }
      } catch (err) {
        setMsg({ ok: false, message: err instanceof Error ? err.message : "照片處理失敗" });
        break;
      }
    }
    setUploading("");
  }

  return (
    <div className={`adm-panel ev-theme ${t && !t.published ? "ph-hidden" : ""}`}>
      {t && (
        <button type="button" className="ev-theme-head" onClick={() => setOpen(!open)} aria-expanded={open}>
          {t.cover_url && <img src={t.cover_url} alt="" />}
          <span>
            <strong>{t.title}</strong>
            <span className="hint">{SHOWCASE_LABEL[t.showcase]}{t.series ? `・${t.series}` : ""}・{photos.length} 張照片{t.published ? "" : "・未顯示"}</span>
          </span>
          <span className="adm-link">{open ? "收起" : "編輯"}</span>
        </button>
      )}
      {open && (
        <>
          <form ref={formRef} onSubmit={submit} className="ev-form" aria-busy={busy}>
            {t && <input type="hidden" name="id" value={t.id} />}
            <div className="adm-grid">
              <label>
                主題名稱
                <input name="title" defaultValue={t?.title ?? ""} required maxLength={60} placeholder="例：機關公仔研究所" />
              </label>
              <label>
                網址代稱（英文）
                <input name="slug" defaultValue={t?.slug ?? ""} maxLength={60} placeholder="例：robot-figure（空白自動產生）" pattern="[a-z0-9\-]*" />
              </label>
              <label>
                工作坊總覽分類
                <select name="showcase" defaultValue={t?.showcase ?? "3d"}>
                  {Object.entries(SHOWCASE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label>
                系列（可不填）
                <input name="series" defaultValue={t?.series ?? ""} maxLength={40} placeholder="例：小小職人系列" />
              </label>
              <label>
                屬於哪個活動卡片（可不選）
                <select name="activity_id" defaultValue={t?.activity_id ?? ""}>
                  <option value="">不選</option>
                  {activities.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </label>
              <label>
                適合對象
                <input name="audience_text" defaultValue={t?.audience_text ?? ""} maxLength={80} placeholder="例：國小三年級以上" />
              </label>
              <label>
                報名表最低年級
                <select name="grade_min" defaultValue={t?.grade_min ?? ""}>
                  <option value="">不限</option>
                  {GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </label>
              <label>
                報名表最高年級
                <select name="grade_max" defaultValue={t?.grade_max ?? ""}>
                  <option value="">不限</option>
                  {GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </label>
              <label>
                時間長度
                <input name="duration_text" defaultValue={t?.duration_text ?? ""} maxLength={80} placeholder="例：3 個週日，共 15 小時" />
              </label>
              <label>
                費用包含
                <input name="includes_text" defaultValue={t?.includes_text ?? ""} maxLength={200} placeholder="例：講師費、場地費、3D 列印耗材" />
              </label>
              <label className="adm-wide">
                備註
                <input name="notes_text" defaultValue={t?.notes_text ?? ""} maxLength={200} placeholder="例：需自備一台筆電；午餐自理" />
              </label>
              <div className="adm-wide ev-field">
                <span className="ev-field-label">介紹</span>
                <RichTextarea name="summary" defaultValue={t?.summary ?? ""} rows={8} maxLength={2000} />
              </div>
              <div className="adm-wide ev-field">
                <span className="ev-field-label">課程特色</span>
                <RichTextarea
                  name="highlights"
                  list
                  defaultValue={t?.highlights.join("\n\n") ?? ""}
                  rows={10}
                  maxLength={3000}
                  placeholder={"🔰 **零基礎也能參加**\n從最基礎開始帶領，沒有經驗也能輕鬆上手\n\n🖥️ **完整體驗 3D 列印流程**\n從建模概念 → 設計 → 切片 → 列印，一次了解"}
                />
              </div>
              <label className="adm-check">
                <input type="checkbox" name="published" defaultChecked={t?.published ?? true} />
                顯示在官網
              </label>
            </div>
            <div className="ph-actions">
              <button type="submit" className="btn btn-sm primary" disabled={busy}>{busy ? "儲存中…" : t ? "儲存" : "新增主題"}</button>
              {t && <ActBtn run={() => deleteTheme(t.id)} label="刪除主題" className="adm-link danger" ask="刪除這個主題和它的照片？" />}
              {msg && <span className={`ph-msg ${msg.ok ? "ok" : "err"}`} role="status">{msg.message}</span>}
            </div>
          </form>
          {t && (
            <div className="ev-photos">
              <p className="ev-sub">課程流程圖（報名頁與主題頁的「課程安排」顯示，可不放）</p>
              <div className="ev-flow">
                {t.flow_url && <img src={t.flow_url} alt="課程流程圖" />}
                <div className="adm-btns">
                  <label className="btn btn-sm">
                    {flowBusy ? "上傳中…" : t.flow_url ? "換一張" : "＋ 上傳流程圖"}
                    <input type="file" accept="image/*" className="sr-only" disabled={flowBusy} onChange={(e) => uploadFlow(e.target.files)} />
                  </label>
                  {t.flow_url && <ActBtn run={() => clearThemeFlow(t.id)} label="拿掉" className="adm-link danger" ask="拿掉這張流程圖？" />}
                </div>
              </div>
              <p className="ev-sub">照片（第一張大圖顯示，⭐ 是卡片封面）</p>
              <div className="ev-photo-grid">
                {photos.map((p, i) => (
                  <figure key={p.id} className={t.cover_url === p.url ? "on" : ""}>
                    <img src={p.url} alt={`照片 ${i + 1}`} />
                    <figcaption className="adm-btns">
                      <ActBtn run={() => moveThemePhoto(p.id, "up")} label="←" className="btn btn-sm" />
                      <ActBtn run={() => moveThemePhoto(p.id, "down")} label="→" className="btn btn-sm" />
                      {t.cover_url !== p.url && <ActBtn run={() => setThemeCover(p.id)} label="⭐" className="btn btn-sm" />}
                      <ActBtn run={() => deleteThemePhoto(p.id)} label="刪除" className="adm-link danger" ask="刪除這張照片？" />
                    </figcaption>
                  </figure>
                ))}
                <label className="ev-photo-add">
                  {uploading || "＋ 上傳照片（可一次選多張）"}
                  <input type="file" accept="image/*" multiple className="sr-only" disabled={!!uploading} onChange={(e) => upload(e.target.files)} />
                </label>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

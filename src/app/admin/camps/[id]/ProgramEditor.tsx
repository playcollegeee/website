"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { shrinkImage } from "@/lib/imageShrink";
import { CAMP_STAGES, MAJOR_INFO, fmtMd, type CampDay, type CampProgram } from "@/lib/campTypes";
import ConfirmButton from "../../ConfirmButton";
import { createProgramSignup, deleteProgram, moveProgram, saveProgram, type CampResult } from "../actions";

type Signup = { href: string; status: string; open: boolean; priced: boolean; seats: string } | null;

// 後台：一個營隊的內容（官網卡片、詳情、每日內容），以及報名的狀態
export default function ProgramEditor({
  program: p,
  isFirst,
  isLast,
  planOptions,
  planLink,
  schedule,
  signup,
  daysText,
}: {
  program: CampProgram;
  isFirst: boolean;
  isLast: boolean;
  planOptions: { id: string; label: string }[];
  planLink: { href: string; label: string } | null;
  schedule: CampDay[]; // 課程規劃裡每天的名稱（不含官網改寫）
  signup: Signup;
  daysText: string;
}) {
  const [ov, setOv] = useState<Record<string, string>>(p.day_overrides ?? {});
  const [img, setImg] = useState<{ blob: Blob; width: number; height: number; url: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(p.title === "新營隊" || !p.tagline);
  const [busy, start] = useTransition();
  const cover = img?.url ?? p.cover_url ?? undefined;

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
    fd.set("day_overrides", JSON.stringify(ov));
    if (img) {
      fd.set("file", img.blob, `cover.${img.blob.type === "image/webp" ? "webp" : "jpg"}`);
      fd.set("width", String(img.width));
      fd.set("height", String(img.height));
    }
    start(async () => {
      const r = await saveProgram(fd);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) setImg(null);
    });
  }
  const act = (fn: () => Promise<CampResult>) =>
    start(async () => {
      const r = await fn();
      if (r.message) setMsg({ ok: r.ok, text: r.message });
    });

  return (
    <form onSubmit={submit} className={`adm-panel cmp-prog ${p.published ? "" : "ph-hidden"}`} aria-busy={busy}>
      <input type="hidden" name="id" value={p.id} />
      <div className="cmp-prog-head">
        <button type="button" className="cmp-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span aria-hidden="true">{open ? "▾" : "▸"}</span> <strong>{p.title}</strong>
          <span className="hint"> {daysText}{p.published ? "" : "（不顯示）"}</span>
        </button>
        <span className="cmp-signup">
          {signup ? (
            <>
              <span className={`tag ${signup.open ? "tag-green" : ""}`}>報名：{signup.status}</span>
              {signup.seats && <span className="hint">{signup.seats}</span>}
              <Link href={signup.href} className="adm-inline">
                {signup.open ? "看名單 →" : signup.priced ? "到活動報名開放 →" : "到活動報名填金額 →"}
              </Link>
            </>
          ) : (
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => act(() => createProgramSignup(p.id))}>
              建立報名
            </button>
          )}
        </span>
      </div>

      {open && (
        <>
          <div className="cmp-grid">
            <label className="ph-img cmp-cover">
              {cover ? <img src={cover} alt="" /> : <span className="ph-empty">＋ 營隊封面照片</span>}
              <span className="ph-img-btn">{cover ? "更換照片" : "選擇照片"}</span>
              <input type="file" name="picker" accept="image/*" onChange={pick} className="sr-only" />
            </label>
            <div className="ph-fields">
              <label className="ph-wide">
                營隊名稱
                <input name="title" defaultValue={p.title} maxLength={60} required />
              </label>
              <label className="ph-wide">
                一句話介紹（卡片上會出現）
                <input name="tagline" defaultValue={p.tagline} maxLength={120} placeholder="例：用樂高打造會動的年獸，學齒輪與連桿" />
              </label>
              <label>
                主修
                <select name="major" defaultValue={p.major}>
                  {Object.entries(MAJOR_INFO).map(([v, m]) => (
                    <option key={v} value={v}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label>
                適合年級說明
                <input name="grade_text" defaultValue={p.grade_text ?? ""} maxLength={40} placeholder="例：國小一～三年級" />
              </label>
              <fieldset className="ph-wide cmp-stages">
                <legend>適合階段（家長篩選用）</legend>
                {CAMP_STAGES.map((st) => (
                  <label key={st.slug} className="ph-check">
                    <input type="checkbox" name="stages" value={st.slug} defaultChecked={p.stages.includes(st.slug)} />
                    {st.name}<span className="hint">（{st.grades}）</span>
                  </label>
                ))}
              </fieldset>
            </div>
          </div>
          <div className="ph-fields">
            <label className="ph-wide">
              營隊重點（一行一點，最多 6 點）
              <textarea name="highlights" defaultValue={p.highlights.join("\n")} rows={4} maxLength={1200} placeholder={"齒輪與連桿：讓作品動起來\n分組任務：一起完成年獸大遊行"} />
            </label>
            <label className="ph-wide">
              帶回家的作品
              <input name="takeaway" defaultValue={p.takeaway ?? ""} maxLength={80} placeholder="例：會走路的機械年獸（積木不帶回）" />
            </label>
            <label className="ph-wide">
              課程規劃
              <select name="plan_id" defaultValue={p.plan_id ?? ""}>
                <option value="">（不連結）</option>
                {planOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
            {planLink && (
              <p className="hint ph-wide">
                每天的內容來自 <Link href={planLink.href}>{planLink.label}</Link>；在課程規劃改，官網就跟著變。
              </p>
            )}
          </div>

          <div className="cmp-sched">
            <label className="ph-check">
              <input type="checkbox" name="show_schedule" defaultChecked={p.show_schedule} />
              在官網顯示每天上午／下午的內容
            </label>
            {schedule.length > 0 ? (
              <table className="adm-table cmp-sched-table">
                <thead>
                  <tr><th>日期</th><th>上午</th><th>下午</th></tr>
                </thead>
                <tbody>
                  {schedule.map((d) => (
                    <tr key={d.day}>
                      <td>{fmtMd(d.day)}</td>
                      {(["am", "pm"] as const).map((slot) => {
                        const k = `${d.day}:${slot}`;
                        return (
                          <td key={slot}>
                            <input
                              aria-label={`${fmtMd(d.day)}${slot === "am" ? "上午" : "下午"}官網文字`}
                              value={ov[k] ?? ""}
                              placeholder={d[slot] || "（規劃裡還沒填）"}
                              maxLength={60}
                              onChange={(e) => setOv((o) => ({ ...o, [k]: e.target.value }))}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="hint">連結課程規劃（有日期）後，這裡會列出每天的內容。</p>
            )}
            <p className="hint">灰色字是課程規劃裡的名稱；想在官網寫得更吸引家長，就在格子裡改寫（空白就用規劃的名稱）。</p>
          </div>

          <div className="ph-actions">
            <label className="ph-check">
              <input type="checkbox" name="published" defaultChecked={p.published} />
              顯示在官網
            </label>
            <button type="submit" className="btn btn-sm primary" disabled={busy}>{busy ? "處理中…" : "儲存"}</button>
            <button type="button" className="btn btn-sm" disabled={busy || isFirst} onClick={() => act(() => moveProgram(p.id, "up"))} aria-label="往前移">↑</button>
            <button type="button" className="btn btn-sm" disabled={busy || isLast} onClick={() => act(() => moveProgram(p.id, "down"))} aria-label="往後移">↓</button>
            <ConfirmButton
              label="刪除"
              message="只刪除官網上的營隊介紹，報名資料會保留在活動報名。確定嗎？"
              confirmLabel="確定刪除"
              onConfirm={() => act(() => deleteProgram(p.id))}
            />
            {msg && <span className={`ph-msg ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</span>}
          </div>
        </>
      )}
      {!open && msg && <span className={`ph-msg ${msg.ok ? "ok" : "err"}`} role="status">{msg.text}</span>}
    </form>
  );
}

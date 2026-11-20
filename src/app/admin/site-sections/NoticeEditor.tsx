"use client";

import { useState, useTransition } from "react";
import {
  NOTICE_CTA_MAX,
  NOTICE_HREF_MAX,
  NOTICE_TEXT_MAX,
  autoNoticeText,
  type NewsSetting,
  type NoticeMode,
  type NoticeSetting,
  type OpenRunSummary,
} from "@/lib/noticeTypes";
import { setNews, setNotice } from "./actions";

const MODES: { v: NoticeMode; label: string; note: string }[] = [
  { v: "auto", label: "自動", note: "顯示最近一場報名中的活動，活動開放或結束時自動換；沒有報名中的活動時顯示「積木故事屋」的備用文字。" },
  { v: "custom", label: "自己寫", note: "自己填公告文字、按鈕文字與連結。" },
  { v: "off", label: "不顯示", note: "整條公告列拿掉。" },
];

// 頂部公告列：模式、自己寫的內容、即時預覽
export function NoticeEditor({ initial, runs, fallback }: { initial: NoticeSetting; runs: OpenRunSummary[]; fallback: string }) {
  const [n, setN] = useState<NoticeSetting>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const set = (patch: Partial<NoticeSetting>) => {
    setN((x) => ({ ...x, ...patch }));
    setMsg(null);
  };

  const preview =
    n.mode === "off"
      ? null
      : n.mode === "custom"
        ? { text: n.text || "（還沒填公告文字）", cta: n.cta || "看更多" }
        : runs[0]
          ? { text: autoNoticeText(runs[0]), cta: "立即報名" }
          : { text: fallback, cta: "看活動" };

  return (
    <div className="nt-edit">
      <div className="nt-modes" role="radiogroup" aria-label="公告列要顯示什麼">
        {MODES.map((m) => (
          <label key={m.v} className={n.mode === m.v ? "on" : ""}>
            <input type="radio" name="nt-mode" checked={n.mode === m.v} onChange={() => set({ mode: m.v })} />
            <strong>{m.label}</strong>
            <span>{m.note}</span>
          </label>
        ))}
      </div>

      {n.mode === "custom" && (
        <>
          {runs.length > 0 && (
            <div className="nt-quick">
              <span className="hint">從報名中的活動帶入：</span>
              {runs.map((r) => (
                <button
                  key={r.runId}
                  type="button"
                  className="btn btn-sm"
                  onClick={() => set({ text: autoNoticeText(r).slice(0, NOTICE_TEXT_MAX), cta: "立即報名", href: r.href })}
                >
                  {r.title}
                  {r.date ? ` ${r.date}` : ""}
                </button>
              ))}
            </div>
          )}
          <div className="ph-fields">
            <label className="ph-wide">
              公告文字（{n.text.length}／{NOTICE_TEXT_MAX}，手機只顯示一行，重點放前面）
              <input value={n.text} maxLength={NOTICE_TEXT_MAX} onChange={(e) => set({ text: e.target.value })} placeholder="例：寒假營隊開放報名｜1/20 起，早鳥優惠中" />
            </label>
            <label>
              按鈕文字（{NOTICE_CTA_MAX} 字內）
              <input value={n.cta} maxLength={NOTICE_CTA_MAX} onChange={(e) => set({ cta: e.target.value })} placeholder="例：立即報名" />
            </label>
            <label>
              連結（本站路徑或 https 網址）
              <input value={n.href} maxLength={NOTICE_HREF_MAX} onChange={(e) => set({ href: e.target.value })} placeholder="例：/workshops 或 /camp" />
            </label>
          </div>
        </>
      )}

      <p className="hint nt-label">官網上會長這樣：</p>
      {preview ? (
        <div className="announce nt-preview" aria-hidden="true">
          <div className="announce-inner">
            <span>{preview.text}</span>
            <a>{preview.cta} →</a>
          </div>
        </div>
      ) : (
        <p className="hint">（不顯示公告列）</p>
      )}

      <div className="nt-save">
        <button
          type="button"
          className="btn primary btn-sm"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const r = await setNotice(n);
              setMsg({ ok: r.ok, text: r.message });
            })
          }
        >
          {busy ? "儲存中…" : "儲存公告列"}
        </button>
        {msg && (
          <span className={`hint ${msg.ok ? "" : "nt-err"}`} role="status">
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}

// 右下角最新消息小卡：開關＋放哪一場
export function NewsEditor({ initial, runs }: { initial: NewsSetting; runs: OpenRunSummary[] }) {
  const [n, setN] = useState<NewsSetting>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const save = (next: NewsSetting) => {
    const prev = n;
    setN(next);
    setMsg(null);
    start(async () => {
      const r = await setNews(next);
      if (!r.ok) setN(prev);
      setMsg({ ok: r.ok, text: r.message });
    });
  };
  const current = n.on ? runs.find((r) => r.runId === n.runId) ?? runs[0] : undefined;
  return (
    <div className="nt-edit">
      <div className="nt-save">
        <button type="button" role="switch" aria-checked={n.on} className={`flag-btn${n.on ? " on" : ""}`} disabled={busy} onClick={() => save({ ...n, on: !n.on })}>
          <span className="flag-knob" aria-hidden="true" />
          {n.on ? "顯示中" : "已隱藏"}
        </button>
        {n.on && runs.length > 1 && (
          <label className="nt-pick">
            放哪一場
            <select value={n.runId ?? ""} disabled={busy} onChange={(e) => save({ ...n, runId: e.target.value || null })}>
              <option value="">自動（最近一場）</option>
              {runs.map((r) => (
                <option key={r.runId} value={r.runId}>
                  {r.title} {r.date}
                </option>
              ))}
            </select>
          </label>
        )}
        {msg && (
          <span className={`hint ${msg.ok ? "" : "nt-err"}`} role="status">
            {msg.text}
          </span>
        )}
      </div>
      <p className="hint">
        {!n.on
          ? "小卡已隱藏；預約試聽打開時，右下角會改放預約按鈕。"
          : current
            ? `目前放：${current.title}${current.date ? ` ${current.date}` : ""}${current.area ? `・${current.area}` : ""}`
            : "目前沒有報名中的活動，所以小卡不會出現。到「活動報名」把開課設成報名中就會自動出現。"}
      </p>
    </div>
  );
}

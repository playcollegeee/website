"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CAMP_STAGES, MAJOR_INFO, SEAT_TEXT, STAGE_NAME, fmtDays, fmtMd, type CampCard, type CampMajor } from "@/lib/campTypes";

// 營隊卡片：依孩子的階段、主修篩選；點卡片打開詳情（網址 #camp-營隊id 也會打開，行事曆用）
export default function CampExplorer({ cards }: { cards: CampCard[] }) {
  const [stage, setStage] = useState<string>("all");
  const [major, setMajor] = useState<CampMajor | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);

  const stages = CAMP_STAGES.filter((s) => cards.some((c) => c.stages.includes(s.slug)));
  const majors = (Object.keys(MAJOR_INFO) as CampMajor[]).filter((m) => cards.some((c) => c.major === m));
  const list = useMemo(
    () => cards.filter((c) => (stage === "all" || c.stages.includes(stage)) && (major === "all" || c.major === major)),
    [cards, stage, major],
  );
  const current = cards.find((c) => c.id === openId) ?? null;

  const open = useCallback((id: string) => {
    setOpenId(id);
    if (location.hash !== `#camp-${id}`) history.replaceState(null, "", `#camp-${id}`);
  }, []);
  const close = useCallback(() => {
    setOpenId(null);
    if (location.hash.startsWith("#camp-")) history.replaceState(null, "", location.pathname + location.search);
  }, []);

  // 網址帶 #camp-xxx（行事曆、分享連結）就打開那個營隊
  useEffect(() => {
    const fromHash = () => {
      const m = /^#camp-([0-9a-f-]{36})$/.exec(location.hash);
      if (m && cards.some((c) => c.id === m[1])) setOpenId(m[1]);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [cards]);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (current && !d.open) d.showModal();
    if (!current && d.open) d.close();
  }, [current]);

  if (cards.length === 0) return <p className="lead">營隊內容準備中，敬請期待！</p>;

  return (
    <>
      {(stages.length > 1 || majors.length > 1) && (
        <div className="cp-filter" role="group" aria-label="篩選營隊">
          {stages.length > 1 && (
            <div className="cp-filter-row">
              <span>孩子的階段</span>
              <Chip on={stage === "all"} onClick={() => setStage("all")}>全部</Chip>
              {stages.map((s) => (
                <Chip key={s.slug} on={stage === s.slug} onClick={() => setStage(s.slug)}>
                  {s.name}<small>{s.grades}</small>
                </Chip>
              ))}
            </div>
          )}
          {majors.length > 1 && (
            <div className="cp-filter-row">
              <span>想玩什麼</span>
              <Chip on={major === "all"} onClick={() => setMajor("all")}>全部</Chip>
              {majors.map((m) => (
                <Chip key={m} on={major === m} onClick={() => setMajor(m)}>{MAJOR_INFO[m].short}</Chip>
              ))}
            </div>
          )}
          <p className="cp-count-line" aria-live="polite">共 {list.length} 個營隊</p>
        </div>
      )}

      <div className="cp-cards">
        {list.map((c) => (
          <article key={c.id} id={`card-${c.id}`} className={`cp-card cp-c-${c.color}`}>
            <button type="button" className="cp-card-hit" onClick={() => open(c.id)} aria-label={`看「${c.title}」的內容`} />
            <div className="cp-card-img">
              {c.cover_url ? (
                <Image src={c.cover_url} alt="" width={640} height={480} sizes="(max-width: 700px) 100vw, 360px" />
              ) : (
                <div className="cp-card-ph" aria-hidden="true"><img src="/brand/parts/roof.png" alt="" /></div>
              )}
              <Seat c={c} />
            </div>
            <div className="cp-card-body">
              <p className="cp-date">{fmtDays(c.days)}<span>・{c.days.length} 天</span></p>
              <h3>{c.title}</h3>
              {c.tagline && <p className="cp-tagline">{c.tagline}</p>}
              <p className="cp-badges">
                <span className={`cp-major cp-m-${c.major}`}>{MAJOR_INFO[c.major].short}</span>
                {c.grade_text ? <span>{c.grade_text}</span> : c.stages.map((s) => <span key={s}>{STAGE_NAME[s]}</span>)}
              </p>
              <div className="cp-card-cta">
                <button type="button" className="btn btn-sm" onClick={() => open(c.id)}>看內容</button>
                <SignupBtn c={c} small />
              </div>
            </div>
          </article>
        ))}
        {list.length === 0 && (
          <p className="cp-none">
            這個條件目前沒有營隊。<button type="button" className="adm-link" onClick={() => { setStage("all"); setMajor("all"); }}>看全部</button>
          </p>
        )}
      </div>

      <dialog ref={dlg} className="cp-dlg" onClose={close} onClick={(e) => e.target === dlg.current && close()} aria-labelledby="cp-dlg-title">
        {current && (
          <div className={`cp-dlg-in cp-c-${current.color}`}>
            <button type="button" className="cp-dlg-x" onClick={close} aria-label="關閉">✕</button>
            {current.cover_url && (
              <div className="cp-dlg-img">
                <Image src={current.cover_url} alt={`${current.title}照片`} width={960} height={720} sizes="(max-width: 760px) 100vw, 720px" />
              </div>
            )}
            <div className="cp-dlg-body">
              <p className="cp-badges">
                <span className={`cp-major cp-m-${current.major}`}>{MAJOR_INFO[current.major].label}</span>
                <Seat c={current} inline />
              </p>
              <h2 id="cp-dlg-title">{current.title}</h2>
              {current.tagline && <p className="cp-tagline">{current.tagline}</p>}

              <dl className="cp-info">
                <div><dt>日期</dt><dd>{fmtDays(current.days)}（{current.days.length} 天）</dd></div>
                <div><dt>時間</dt><dd>{current.time_text}，全天參加</dd></div>
                <div>
                  <dt>適合</dt>
                  <dd>{current.grade_text || current.stages.map((s) => STAGE_NAME[s]).join("、") || "—"}</dd>
                </div>
                {current.venue && <div><dt>地點</dt><dd>{current.venue}</dd></div>}
                {current.deadline && <div><dt>報名截止</dt><dd>{fmtMd(current.deadline)}</dd></div>}
              </dl>

              {current.highlights.length > 0 && (
                <>
                  <h3>營隊重點</h3>
                  <ul className="cp-hl">
                    {current.highlights.map((h) => <li key={h}>{h}</li>)}
                  </ul>
                </>
              )}

              {current.schedule.length > 0 && (
                <>
                  <h3>每天做什麼</h3>
                  <ol className="cp-sched">
                    {current.schedule.map((d, i) => (
                      <li key={d.day}>
                        <span className="cp-sched-day">Day {i + 1}<small>{fmtMd(d.day)}</small></span>
                        <span className="cp-sched-slots">
                          {d.am && <span><em>上午</em>{d.am}</span>}
                          {d.pm && <span><em>下午</em>{d.pm}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}

              {current.takeaway && (
                <p className="cp-take"><span aria-hidden="true">🎁</span> 帶回家：{current.takeaway}</p>
              )}

              <div className="btn-row">
                <SignupBtn c={current} />
                <button type="button" className="btn" onClick={close}>回營隊列表</button>
              </div>
              <p className="cp-note">費用請見報名頁。</p>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`cp-chip ${on ? "on" : ""}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

function Seat({ c, inline }: { c: CampCard; inline?: boolean }) {
  const text = c.seat === "few" && c.left ? `剩 ${c.left} 位` : SEAT_TEXT[c.seat];
  return <span className={`cp-seat cp-s-${c.seat} ${inline ? "inline" : ""}`}>{text}</span>;
}

function SignupBtn({ c, small }: { c: CampCard; small?: boolean }) {
  const cls = `btn primary ${small ? "btn-sm" : ""}`;
  if (c.signup_href) return <Link href={c.signup_href} className={cls}>{c.seat === "waitlist" ? "登記候補" : "立即報名"}</Link>;
  if (c.seat === "soon") return <Link href={c.notify_href} className={`btn ${small ? "btn-sm" : ""}`}>開放時通知我</Link>;
  return null;
}

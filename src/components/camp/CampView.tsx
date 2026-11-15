import Image from "next/image";
import Link from "next/link";
import PhotoMarquee, { fillTo } from "@/components/PhotoMarquee";
import { site } from "@/lib/content";
import {
  CAMP_STAGES,
  SEASON_LABEL,
  earlyDaysLeft,
  fmtDays,
  fmtMd,
  isPending,
  todayTw,
  type CampCard,
  type CampSeason,
} from "@/lib/campTypes";
import CampExplorer from "./CampExplorer";
import CampStickyBar from "./CampStickyBar";

// 官網冬夏令營頁面（/camp、/camp/[slug]）
// 參考布拉克星球 2027 冬令營頁（營隊分類、行事曆、Q&A、多處報名按鈕）與國外營隊網站常見的做法
// （依年齡篩選、即時名額、一天的流程、要帶什麼、手機底部報名按鈕），程式與版面自己寫
// 2026-11-15 使用者決定：營隊頁不顯示價格（只在報名頁看）、一律全天、有早鳥優惠
export default function CampView({ season: s, cards, preview }: { season: CampSeason; cards: CampCard[]; preview?: boolean }) {
  const today = todayTw();
  const allDays = [...new Set(cards.flatMap((c) => c.days))].sort();
  const early = earlyDaysLeft(s, today);
  const stagesUsed = CAMP_STAGES.filter((st) => cards.some((c) => c.stages.includes(st.slug)));
  const covers = [s.cover_url, ...cards.map((c) => c.cover_url)].filter(Boolean).slice(0, 3) as string[];
  const faq = s.faq.filter((f) => !isPending(f.a));
  const cats = [...new Set(faq.map((f) => f.cat))];
  const bring = s.bring.split("\n").map((x) => x.trim()).filter(Boolean);
  const label = SEASON_LABEL[s.season];
  const anyOpen = cards.some((c) => c.signup_href);

  return (
    <div className={`cp cp-${s.season}`}>
      {preview && (
        <p className="cp-preview" role="status">
          👀 預覽模式：這一季還是草稿，只有登入的老師看得到。<Link href="/admin/camps">回後台</Link>
        </p>
      )}

      {/* 1. 首屏 */}
      <section className="cp-hero">
        <span className="cp-flakes" aria-hidden="true" />
        <div className="container cp-hero-inner">
          <div className="cp-hero-text">
            <p className="eyebrow">玩學院 Play Collegeee｜{s.season === "winter" ? "寒假" : "暑假"}營隊</p>
            <h1>{s.title}</h1>
            {s.headline && <p className="cp-headline">{s.headline}</p>}
            <ul className="cp-facts">
              <li><span aria-hidden="true">📅</span>{fmtDays(allDays)}</li>
              <li><span aria-hidden="true">⏰</span>{cards[0]?.time_text ?? "全天營隊"}・全天參加</li>
              <li><span aria-hidden="true">🏕️</span>{cards.length} 個營隊</li>
              {stagesUsed.length > 0 && (
                <li><span aria-hidden="true">🧒</span>{stagesUsed.map((x) => `${x.name}`).join("、")}</li>
              )}
            </ul>
            <div className="btn-row">
              <a href="#camps" className="btn primary">看營隊{anyOpen ? "・立即報名" : ""}</a>
              <a href="#calendar" className="btn">日期一覽</a>
            </div>
          </div>
          <div className="cp-hero-pics" aria-hidden={covers.length === 0}>
            {covers.map((u, i) => (
              <div key={u + i} className={`cp-pic cp-pic-${i}`}>
                <Image src={u} alt="" width={600} height={450} sizes="(max-width: 860px) 70vw, 380px" priority={i === 0} />
              </div>
            ))}
            <img src="/brand/parts/roof.png" alt="" className="cp-part cp-part-a" />
            <img src="/brand/parts/box.png" alt="" className="cp-part cp-part-b" />
            <img src="/brand/parts/cap.png" alt="" className="cp-part cp-part-c" />
          </div>
        </div>
      </section>

      {/* 早鳥 */}
      {early !== null && (
        <div className="cp-early" role="note">
          <div className="container cp-early-inner">
            <strong>🐣 早鳥優惠</strong>
            <span>{s.early_text || `${fmtMd(s.early_until!)} 前完成報名享早鳥優惠，詳見報名頁`}</span>
            <span className="cp-count">{early === 0 ? "今天截止！" : <>還剩 <b>{early}</b> 天</>}</span>
          </div>
        </div>
      )}

      {s.intro && (
        <section className="cp-intro">
          <div className="container">
            <p className="cp-intro-text">{s.intro}</p>
          </div>
        </section>
      )}

      {/* 2. 營隊（篩選＋卡片＋詳情） */}
      <section id="camps" className="cp-camps">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">CAMPS</p>
            <h2>選一個營隊</h2>
            <p className="lead">每一梯都是獨立的營隊、一律全天參加，請分別報名。名額即時更新。</p>
          </div>
          <CampExplorer cards={cards} />
        </div>
      </section>

      {/* 3. 一天的流程 */}
      {s.day_flow.length > 0 && (
        <section className="cp-day bg-yellow">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">A DAY AT CAMP</p>
              <h2>營隊的一天</h2>
            </div>
            <ol className="cp-flow">
              {s.day_flow.map((f, i) => (
                <li key={i} className={`cp-flow-${["blue", "red", "green", "yellow"][i % 4]}`}>
                  <time>{f.time}</time>
                  <strong>{f.title}</strong>
                  {f.note && <span>{f.note}</span>}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* 4. 行事曆 */}
      {allDays.length > 0 && (
        <section id="calendar" className="cp-cal">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">CALENDAR</p>
              <h2>把精彩排進{s.season === "winter" ? "寒假" : "暑假"}</h2>
              <p className="lead">點營隊名稱看內容。</p>
            </div>
            <Calendar cards={cards} days={allDays} />
          </div>
        </section>
      )}

      {/* 5. 創作現場 */}
      {s.photos.length > 0 && (
        <section className="cp-photos bg-blue">
          <div className="container section-head">
            <p className="eyebrow">MOMENTS</p>
            <h2>認真的模樣，完成作品的笑容</h2>
          </div>
          <PhotoMarquee label={`${label}照片`} seconds={fillTo(s.photos, 6).length * 7}>
            {fillTo(s.photos, 6).map((p, i) => (
              <div key={p.url + i} className="photo-item cp-photo" aria-hidden={i >= s.photos.length ? true : undefined}>
                <Image src={p.url} alt={`${label}活動照片`} width={p.width} height={p.height} sizes="280px" />
              </div>
            ))}
          </PhotoMarquee>
        </section>
      )}

      {/* 6. 報名流程 */}
      <section className="cp-steps">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">HOW TO JOIN</p>
            <h2>報名三步驟</h2>
          </div>
          <ol className="cp-step-list">
            <li><b>1</b><strong>線上報名</strong><span>選好營隊，填寫孩子的資料，馬上拿到報名編號。</span></li>
            <li><b>2</b><strong>匯款＋回填末五碼</strong><span>依報名頁的資訊匯款，在查詢頁填帳號末五碼。</span></li>
            <li><b>3</b><strong>收到確認</strong><span>老師對帳後私訊通知報名完成，開課前再提醒一次。</span></li>
          </ol>
        </div>
      </section>

      {/* 7. 準備與接送 */}
      {(bring.length > 0 || (s.pickup && !isPending(s.pickup))) && (
        <section className="cp-prep bg-green">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">BEFORE CAMP</p>
              <h2>出發前的準備</h2>
            </div>
            <div className="grid cols-2">
              {bring.length > 0 && (
                <div className="card">
                  <h3>🎒 要帶什麼</h3>
                  <ul className="cp-bring">
                    {bring.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                </div>
              )}
              {s.pickup && !isPending(s.pickup) && (
                <div className="card">
                  <h3>📍 地點與接送</h3>
                  <p className="cp-pre">{s.pickup}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 8. 家長 Q&A */}
      {faq.length > 0 && (
        <section id="faq" className="cp-faq">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">Q&A</p>
              <h2>家長 Q&A</h2>
            </div>
            {cats.map((c) => (
              <div key={c} className="cp-faq-group">
                <h3>{c}</h3>
                {faq.filter((f) => f.cat === c).map((f) => (
                  <details key={f.q}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 9. 結尾 */}
      <section className="cp-end">
        <div className="container cp-end-inner">
          <h2>還有問題？歡迎問我們</h2>
          <p className="lead">{site.taglineShort}</p>
          <div className="btn-row">
            {anyOpen && <a href="#camps" className="btn primary">立即報名</a>}
            <Link href={`/contact?type=workshop&activity=${encodeURIComponent(s.title)}`} className="btn">留言詢問</Link>
            <a href={site.facebook} className="btn" target="_blank" rel="noopener noreferrer">Facebook 私訊 ↗</a>
          </div>
        </div>
      </section>

      <CampStickyBar label={anyOpen ? "立即報名" : "看營隊"} early={early} />
    </div>
  );
}

// 行事曆：一個月一張，營隊的日子塗上營隊顏色
function Calendar({ cards, days }: { cards: CampCard[]; days: string[] }) {
  const months = [...new Set(days.map((d) => d.slice(0, 7)))];
  return (
    <div className="cp-cal-wrap">
      <ul className="cp-legend">
        {cards.map((c) => (
          <li key={c.id}>
            <a href={`#camp-${c.id}`} className={`cp-chip-${c.color}`}>
              <i aria-hidden="true" />
              {c.title}<span>{fmtDays(c.days)}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="cp-months">
        {months.map((ym) => {
          const [y, m] = ym.split("-").map(Number);
          const first = new Date(Date.UTC(y, m - 1, 1));
          const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
          const lead = first.getUTCDay();
          const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];
          return (
            <div key={ym} className="cp-month">
              <h3>{y} 年 {m} 月</h3>
              <div className="cp-grid" role="grid" aria-label={`${y} 年 ${m} 月`}>
                {["日", "一", "二", "三", "四", "五", "六"].map((w) => <b key={w}>{w}</b>)}
                {cells.map((d, i) => {
                  if (!d) return <span key={i} />;
                  const on = cards.filter((c) => c.days.includes(d));
                  return (
                    <span key={d} className={on.length ? `on cp-bg-${on[0].color}` : ""} title={on.map((c) => c.title).join("、") || undefined}>
                      {Number(d.slice(8))}
                      {on.length > 1 && <i aria-hidden="true">{on.length}</i>}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

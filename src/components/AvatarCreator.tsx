"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { burstConfetti } from "@/lib/confetti";

// 角色試玩：選主修路線、捏外觀、拉「上課次數」看裝備一件件解鎖。
// 全部在瀏覽器裡算，不會上傳任何資料（暱稱也只留在這個頁面）。
// 裝備名稱、解鎖順序與經驗值都是示意，正式規則以角色養成系統為準。

type Track = "lego" | "3d" | "art";
type Slot = "hand" | "helmet" | "boots" | "cape";

const TRACKS: Record<
  Track,
  { job: string; major: string; color: string; soft: string; title: string; skill: string; gear: Record<Slot, string> }
> = {
  lego: {
    job: "機關工程師",
    major: "LEGO 樂高建構與機器人",
    color: "#ea5754",
    soft: "#fde4e3",
    title: "初級機關師",
    skill: "力量放大",
    gear: { hand: "齒輪拳套", helmet: "感測器頭盔", boots: "馬達靴", cape: "連桿披風" },
  },
  "3d": {
    job: "造物工匠",
    major: "3D 列印與造物",
    color: "#5cbeaa",
    soft: "#e3f4f0",
    title: "初級造物師",
    skill: "無中生有",
    gear: { hand: "列印錘", helmet: "建模護目鏡", boots: "噴頭靴", cape: "線材披風" },
  },
  art: {
    job: "色彩魔法師",
    major: "美術與視覺創作",
    color: "#5098d2",
    soft: "#e2eef8",
    title: "初級色彩師",
    skill: "色彩融合",
    gear: { hand: "調色魔杖", helmet: "畫家帽", boots: "顏料靴", cape: "光影斗篷" },
  },
};

// 第幾次上課解鎖哪一件（示意）
const UNLOCKS: { at: number; slot: Slot }[] = [
  { at: 1, slot: "hand" },
  { at: 3, slot: "helmet" },
  { at: 5, slot: "boots" },
  { at: 8, slot: "cape" },
];
const MAX = 10; // 第 10 次上課：獲得稱號與技能
const XP_PER = 10; // 每次上課基本經驗值

const SKINS = ["#ffd9b8", "#f1c093", "#c98e62", "#8d5a3b"];
const BODIES = ["#fbc20f", "#5cbeaa", "#ea5754", "#5098d2", "#9b7bd4"];
const FACES = ["smile", "grin", "cool", "wow"] as const;
type Face = (typeof FACES)[number];
const FACE_LABEL: Record<Face, string> = { smile: "微笑", grin: "開心", cool: "酷酷", wow: "驚喜" };

export default function AvatarCreator() {
  const [track, setTrack] = useState<Track>("lego");
  const [skin, setSkin] = useState(SKINS[0]);
  const [body, setBody] = useState(BODIES[1]);
  const [face, setFace] = useState<Face>("smile");
  const [name, setName] = useState("小創客");
  const [lessons, setLessons] = useState(0);
  const [toast, setToast] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const prev = useRef(0);

  const t = TRACKS[track];
  const has = (slot: Slot) => UNLOCKS.some((u) => u.slot === slot && lessons >= u.at);
  const xp = lessons * XP_PER;
  const done = lessons >= MAX;
  const nextUnlock = UNLOCKS.find((u) => u.at > lessons);

  // 上課次數往上加，剛好解鎖時跳通知＋紙片
  useEffect(() => {
    const before = prev.current;
    prev.current = lessons;
    if (lessons <= before) return;
    const got = UNLOCKS.filter((u) => u.at > before && u.at <= lessons).map((u) => t.gear[u.slot]);
    if (lessons >= MAX && before < MAX) got.push(`稱號「${t.title}」＋技能〔${t.skill}〕`);
    if (got.length === 0) return;
    setToast(`解鎖：${got.join("、")}！`);
    const r = svgRef.current?.getBoundingClientRect();
    if (r) burstConfetti(r.left + r.width / 2, r.top + r.height / 3, 60);
    const id = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(id);
  }, [lessons, t]);

  function randomize() {
    const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
    setSkin(pick(SKINS));
    setBody(pick(BODIES));
    setFace(pick(FACES));
  }

  // 存成圖片：把 SVG 畫到 canvas 再下載 PNG
  function download() {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 720;
      c.height = 980;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = t.soft;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, 720, 900);
      // 底部品牌列：分享出去時看得到是玩學院
      ctx.fillStyle = t.color;
      ctx.fillRect(0, 930, c.width, 50);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("玩學院 Play Collegeee・playcollegeee.com", 360, 964);
      const a = document.createElement("a");
      a.download = `玩學院角色-${t.job}.png`;
      a.href = c.toDataURL("image/png");
      a.click();
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  }

  return (
    <div className="ac" style={{ ["--ac" as string]: t.color, ["--ac-soft" as string]: t.soft }}>
      <div className="ac-stage">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 240 300"
          role="img"
          aria-label={`${name || "我的角色"}，${t.job}，已解鎖 ${UNLOCKS.filter((u) => has(u.slot)).length} 件裝備`}
          className="ac-svg"
        >
          <Character track={track} skin={skin} body={body} face={face} has={has} glow={done} />
          {/* 名牌 */}
          <g>
            <rect x="40" y="268" width="160" height="26" rx="13" fill="#fff" stroke="#2b2b2b" strokeWidth="2" />
            <text x="120" y="286" textAnchor="middle" fontSize="14" fontWeight="700" fill="#2b2b2b" fontFamily="sans-serif">
              {(name || "我的角色").slice(0, 8)}・{done ? t.title : t.job}
            </text>
          </g>
        </svg>
        <div className="ac-toast" role="status" aria-live="polite">
          {toast && <span className="pop-in">{toast}</span>}
        </div>
        {/* 手機版：角色下方直接放上課按鈕，不用捲來捲去 */}
        <div className="ac-quick">
          <span>已上 {lessons} 次課・經驗值 {xp}</span>
          <button type="button" className="btn btn-sm primary" onClick={() => setLessons((n) => Math.min(MAX, n + 1))} disabled={done}>
            {done ? "全部解鎖 ✓" : "＋ 上一堂課"}
          </button>
        </div>
      </div>

      <div className="ac-panel">
        <fieldset className="ac-field">
          <legend>1. 選一條主修路線</legend>
          <div className="ac-tracks">
            {(Object.keys(TRACKS) as Track[]).map((k) => (
              <button
                key={k}
                type="button"
                className={`ac-track ${track === k ? "on" : ""}`}
                style={{ ["--c" as string]: TRACKS[k].color }}
                aria-pressed={track === k}
                onClick={() => setTrack(k)}
              >
                <strong>{TRACKS[k].job}</strong>
                <small>{TRACKS[k].major}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="ac-field">
          <legend>2. 捏出你的角色</legend>
          <label className="ac-name">
            暱稱
            <input value={name} maxLength={8} onChange={(e) => setName(e.target.value)} placeholder="小創客" />
          </label>
          <div className="ac-row">
            <span>膚色</span>
            {SKINS.map((c) => (
              <button key={c} type="button" className={`ac-swatch ${skin === c ? "on" : ""}`} style={{ background: c }} aria-label={`膚色 ${c}`} aria-pressed={skin === c} onClick={() => setSkin(c)} />
            ))}
          </div>
          <div className="ac-row">
            <span>衣服</span>
            {BODIES.map((c) => (
              <button key={c} type="button" className={`ac-swatch ${body === c ? "on" : ""}`} style={{ background: c }} aria-label={`衣服顏色 ${c}`} aria-pressed={body === c} onClick={() => setBody(c)} />
            ))}
          </div>
          <div className="ac-row">
            <span>表情</span>
            {FACES.map((f) => (
              <button key={f} type="button" className={`ac-chip ${face === f ? "on" : ""}`} aria-pressed={face === f} onClick={() => setFace(f)}>
                {FACE_LABEL[f]}
              </button>
            ))}
            <button type="button" className="ac-chip" onClick={randomize}>🎲 隨機</button>
          </div>
        </fieldset>

        <fieldset className="ac-field">
          <legend>3. 來上課，解鎖裝備</legend>
          <div className="ac-lessons">
            <button type="button" className="btn btn-sm" onClick={() => setLessons((n) => Math.max(0, n - 1))} disabled={lessons === 0} aria-label="少上一次">−</button>
            <input
              type="range"
              min={0}
              max={MAX}
              value={lessons}
              onChange={(e) => setLessons(Number(e.target.value))}
              aria-label="上課次數"
            />
            <button type="button" className="btn btn-sm primary" onClick={() => setLessons((n) => Math.min(MAX, n + 1))} disabled={done}>
              ＋ 上一堂課
            </button>
          </div>
          <p className="ac-xp">
            已上 <strong>{lessons}</strong> 次課・經驗值 <strong>{xp}</strong>
            <span className="ac-bar" aria-hidden="true">
              <span style={{ width: `${(lessons / MAX) * 100}%` }} />
            </span>
          </p>
          <ul className="ac-gear">
            {UNLOCKS.map((u) => (
              <li key={u.slot} className={has(u.slot) ? "got" : ""}>
                <span>{has(u.slot) ? "✓" : "🔒"}</span> {t.gear[u.slot]} <small>第 {u.at} 次</small>
              </li>
            ))}
            <li className={done ? "got" : ""}>
              <span>{done ? "✓" : "🔒"}</span> 稱號「{t.title}」＋〔{t.skill}〕 <small>第 {MAX} 次</small>
            </li>
          </ul>
          <p className="hint">
            {done
              ? "恭喜畢業一個系列！真實課程裡，角色會跟著孩子一期一期長大。"
              : nextUnlock
                ? `再上 ${nextUnlock.at - lessons} 次課，解鎖「${t.gear[nextUnlock.slot]}」。`
                : `再上 ${MAX - lessons} 次課，獲得稱號「${t.title}」。`}
            （試玩用的示意規則）
          </p>
        </fieldset>

        <div className="btn-row">
          <Link href={`/contact?type=trial&major=${track}`} className="btn primary">
            讓角色真的長大：預約試聽
          </Link>
          <button type="button" className="btn" onClick={download}>存成圖片</button>
        </div>
        <p className="hint">暱稱與外觀只留在你的瀏覽器裡，不會上傳。</p>
      </div>
    </div>
  );
}

// ---------- 角色本體（分層疊圖：披風 → 腿與靴 → 身體 → 手與武器 → 頭 → 帽子） ----------
function Character({
  track,
  skin,
  body,
  face,
  has,
  glow,
}: {
  track: Track;
  skin: string;
  body: string;
  face: Face;
  has: (s: Slot) => boolean;
  glow: boolean;
}) {
  const c = TRACKS[track].color;
  const ink = "#2b2b2b";
  const anim = "ac-pop"; // 減少動態效果時由 CSS 關閉
  return (
    <g>
      {/* 稱號光環 */}
      {glow && <circle cx="120" cy="140" r="112" fill="none" stroke={c} strokeWidth="6" strokeDasharray="4 10" opacity="0.6" className={anim} />}

      {/* 披風 */}
      {has("cape") && (
        <g className={anim} key={`cape-${track}`}>
          {track === "lego" && (
            <>
              <path d="M70 118 L170 118 L192 250 L48 250 Z" fill={c} />
              {[0, 1, 2, 3].map((i) => (
                <circle key={i} cx={84 + i * 24} cy="236" r="6" fill="#fff" opacity="0.7" />
              ))}
            </>
          )}
          {track === "3d" && (
            <>
              <path d="M70 118 L170 118 L192 250 L48 250 Z" fill={c} />
              <path d="M58 200 Q90 186 120 200 T182 200 M54 226 Q90 212 120 226 T186 226" stroke="#fff" strokeWidth="4" fill="none" opacity="0.7" />
            </>
          )}
          {track === "art" && (
            <>
              <defs>
                <linearGradient id="ac-cape" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#5098d2" />
                  <stop offset="1" stopColor="#9b7bd4" />
                </linearGradient>
              </defs>
              <path d="M70 118 L170 118 L192 250 L48 250 Z" fill="url(#ac-cape)" />
              {[
                [70, 210],
                [150, 230],
                [170, 196],
                [96, 238],
              ].map(([x, y], i) => (
                <path key={i} d={`M${x} ${y - 6} L${x + 2} ${y - 2} L${x + 6} ${y} L${x + 2} ${y + 2} L${x} ${y + 6} L${x - 2} ${y + 2} L${x - 6} ${y} L${x - 2} ${y - 2} Z`} fill="#fbc20f" />
              ))}
            </>
          )}
        </g>
      )}

      {/* 腿 */}
      <rect x="88" y="200" width="26" height="56" rx="6" fill="#5f6368" />
      <rect x="126" y="200" width="26" height="56" rx="6" fill="#5f6368" />

      {/* 靴子 */}
      {has("boots") && (
        <g className={anim} key={`boots-${track}`}>
          {[82, 122].map((x) => (
            <g key={x}>
              <rect x={x} y="238" width="36" height="24" rx="6" fill={track === "3d" ? c : track === "art" ? "#5098d2" : "#5f6368"} stroke={ink} strokeWidth="2" />
              {track === "lego" && (
                <>
                  <circle cx={x + 9} cy="262" r="6" fill={ink} />
                  <circle cx={x + 27} cy="262" r="6" fill={ink} />
                  <circle cx={x + 9} cy="262" r="2" fill="#fbc20f" />
                  <circle cx={x + 27} cy="262" r="2" fill="#fbc20f" />
                </>
              )}
              {track === "3d" && <path d={`M${x + 12} 238 L${x + 18} 228 L${x + 24} 238 Z`} fill="#fbc20f" stroke={ink} strokeWidth="1.5" />}
              {track === "art" && (
                <>
                  <circle cx={x + 10} cy="248" r="4" fill="#fbc20f" />
                  <circle cx={x + 24} cy="252" r="3" fill="#ea5754" />
                  <circle cx={x + 18} cy="244" r="2.5" fill="#5cbeaa" />
                </>
              )}
            </g>
          ))}
        </g>
      )}

      {/* 身體 */}
      <rect x="78" y="118" width="84" height="90" rx="12" fill={body} stroke={ink} strokeWidth="2" />
      <rect x="104" y="140" width="32" height="32" rx="6" fill="#fff" opacity="0.55" />
      {/* 胸口徽章：主修顏色 */}
      <circle cx="120" cy="156" r="9" fill={c} stroke={ink} strokeWidth="1.5" />

      {/* 手臂 */}
      <rect x="54" y="124" width="22" height="66" rx="10" fill={body} stroke={ink} strokeWidth="2" />
      <rect x="164" y="124" width="22" height="66" rx="10" fill={body} stroke={ink} strokeWidth="2" />
      <circle cx="65" cy="194" r="9" fill={skin} stroke={ink} strokeWidth="1.5" />
      {!has("hand") && <circle cx="175" cy="194" r="9" fill={skin} stroke={ink} strokeWidth="1.5" />}

      {/* 手上的裝備 */}
      {has("hand") && (
        <g className={anim} key={`hand-${track}`}>
          {track === "lego" && (
            <g>
              {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
                <rect key={a} x="171" y="172" width="8" height="10" rx="2" fill="#fbc20f" stroke={ink} strokeWidth="1" transform={`rotate(${a} 175 196)`} />
              ))}
              <circle cx="175" cy="196" r="17" fill="#fbc20f" stroke={ink} strokeWidth="2" />
              <circle cx="175" cy="196" r="6" fill="#fff" stroke={ink} strokeWidth="1.5" />
            </g>
          )}
          {track === "3d" && (
            <g>
              <circle cx="175" cy="194" r="9" fill={skin} stroke={ink} strokeWidth="1.5" />
              <rect x="172" y="150" width="7" height="56" rx="3" fill="#8d5a3b" stroke={ink} strokeWidth="1.5" />
              <rect x="158" y="136" width="36" height="20" rx="4" fill={c} stroke={ink} strokeWidth="2" />
              <path d="M170 156 L175 166 L180 156 Z" fill="#fbc20f" stroke={ink} strokeWidth="1.2" />
            </g>
          )}
          {track === "art" && (
            <g>
              <circle cx="175" cy="194" r="9" fill={skin} stroke={ink} strokeWidth="1.5" />
              <rect x="173" y="140" width="6" height="62" rx="3" fill="#fff" stroke={ink} strokeWidth="1.5" transform="rotate(12 176 170)" />
              <path d="M188 126 L192 136 L203 137 L194 144 L197 155 L188 149 L179 155 L182 144 L173 137 L184 136 Z" fill="#fbc20f" stroke={ink} strokeWidth="1.5" />
            </g>
          )}
        </g>
      )}

      {/* 頭 */}
      <rect x="86" y="50" width="68" height="64" rx="14" fill={skin} stroke={ink} strokeWidth="2" />
      <Face face={face} />

      {/* 帽子／頭盔 */}
      {has("helmet") ? (
        <g className={anim} key={`helmet-${track}`}>
          {track === "lego" && (
            <g>
              <path d="M82 66 Q82 34 120 34 Q158 34 158 66 Z" fill="#fbc20f" stroke={ink} strokeWidth="2" />
              <circle cx="106" cy="52" r="7" fill={c} stroke={ink} strokeWidth="1.5" />
              <circle cx="134" cy="52" r="7" fill={c} stroke={ink} strokeWidth="1.5" />
              <line x1="120" y1="34" x2="120" y2="16" stroke={ink} strokeWidth="3" />
              <circle cx="120" cy="14" r="5" fill={c} stroke={ink} strokeWidth="1.5" />
            </g>
          )}
          {track === "3d" && (
            <g>
              <rect x="84" y="46" width="72" height="10" rx="5" fill={ink} />
              <circle cx="105" cy="51" r="11" fill={c} stroke={ink} strokeWidth="2.5" opacity="0.95" />
              <circle cx="135" cy="51" r="11" fill={c} stroke={ink} strokeWidth="2.5" opacity="0.95" />
              <circle cx="101" cy="47" r="3" fill="#fff" />
              <circle cx="131" cy="47" r="3" fill="#fff" />
            </g>
          )}
          {track === "art" && (
            <g>
              <ellipse cx="116" cy="50" rx="44" ry="14" fill={c} stroke={ink} strokeWidth="2" />
              <ellipse cx="120" cy="42" rx="30" ry="14" fill={c} stroke={ink} strokeWidth="2" />
              <line x1="124" y1="28" x2="128" y2="20" stroke={ink} strokeWidth="3" strokeLinecap="round" />
              <circle cx="98" cy="44" r="3" fill="#fbc20f" />
              <circle cx="140" cy="46" r="2.5" fill="#ea5754" />
            </g>
          )}
        </g>
      ) : (
        // 還沒有帽子：頭頂一顆積木凸點
        <rect x="108" y="40" width="24" height="12" rx="4" fill={skin} stroke={ink} strokeWidth="2" />
      )}
    </g>
  );
}

function Face({ face }: { face: Face }) {
  const ink = "#2b2b2b";
  if (face === "cool")
    return (
      <g>
        <rect x="96" y="74" width="20" height="12" rx="4" fill={ink} />
        <rect x="124" y="74" width="20" height="12" rx="4" fill={ink} />
        <line x1="116" y1="79" x2="124" y2="79" stroke={ink} strokeWidth="3" />
        <path d="M110 100 L132 98" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  return (
    <g>
      {face === "grin" ? (
        <>
          <path d="M102 82 Q108 76 114 82" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M126 82 Q132 76 138 82" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="108" cy="82" r={face === "wow" ? 6 : 5} fill={ink} />
          <circle cx="132" cy="82" r={face === "wow" ? 6 : 5} fill={ink} />
        </>
      )}
      {face === "smile" && <path d="M108 98 Q120 106 132 98" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />}
      {face === "grin" && <path d="M106 95 Q120 112 134 95 Z" fill={ink} />}
      {face === "wow" && <ellipse cx="120" cy="101" rx="6" ry="7" fill={ink} />}
      <circle cx="98" cy="94" r="5" fill="#ea5754" opacity="0.25" />
      <circle cx="142" cy="94" r="5" fill="#ea5754" opacity="0.25" />
    </g>
  );
}

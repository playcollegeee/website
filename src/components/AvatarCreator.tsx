"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { burstConfetti } from "@/lib/confetti";

// 角色試玩（戰棋像素風，2026-11-06 改版）：
// 選主修路線 → 捏見習職業的外觀 → 拉「完成期數」看裝備一件件解鎖。
// 每條路線 6 種轉職只顯示剪影＋名稱，要在教室完成第 1 期才解鎖（保留學生解鎖的感覺）。
// 圖層 PNG 在 public/avatar/（64×64，目前是程式畫的參考稿，正式美術外包後直接替換同名檔案）。
// 全部在瀏覽器裡算，不會上傳任何資料；職業名稱、解鎖規則都是示意，正式規則以角色養成系統為準。

type Track = "eng" | "mak" | "art";

const TRACKS: Record<
  Track,
  {
    job: string; // 路線名稱（暫名）
    novice: string; // 見習職業
    major: string;
    majorKey: string; // 預約試聽表單用的主修代碼
    color: string;
    title: string;
    gear: [string, string, string, string, string]; // 第 1–5 期裝備
    jobs: string[]; // 6 種轉職（只顯示剪影＋名稱）
  }
> = {
  eng: {
    job: "機關工程師",
    novice: "見習機工",
    major: "LEGO 樂高建構與機器人",
    majorKey: "lego",
    color: "#ea5754",
    title: "初級機關師",
    gear: ["鋼鐵手甲", "機關半盔", "護脛鋼靴", "機關披風＋肩甲", "齒輪機關錘"],
    jobs: ["機甲將軍", "重盾衛士", "能量砲手", "機器人指揮官", "飛行工兵", "齒輪魔導士"],
  },
  mak: {
    job: "造物工匠",
    novice: "見習工匠",
    major: "3D 列印與造物",
    majorKey: "3d",
    color: "#5098d2",
    title: "初級造物師",
    gear: ["工匠手甲", "焊接護目盔", "護脛鋼靴", "工匠披風＋肩甲", "鍛造戰鎚"],
    jobs: ["造物機匠", "鍛造師", "鍊造術士", "築城師", "精工雕刻師", "行商工匠"],
  },
  art: {
    job: "色彩魔法師",
    novice: "見習畫士",
    major: "美術與視覺創作",
    majorKey: "art",
    color: "#5cbeaa",
    title: "初級色彩師",
    gear: ["術士手甲", "寬簷法帽", "護脛鋼靴", "星夜披風＋肩甲", "水晶畫筆法杖"],
    jobs: ["戰鬥法師", "賢者", "元素術士", "召喚師", "星帽術士", "羽帽劍術師"],
  },
};

const MAX_TERM = 5;
const XP_PER_TERM = 120; // 示意：一期 12 堂 × 每堂 10 點
const SKINS = [
  { id: "s1", color: "#ecbe98" },
  { id: "s2", color: "#e2ac84" },
  { id: "s3", color: "#be845c" },
  { id: "s4", color: "#845438" },
];
const HAIR_COLORS = [
  { id: "h1", color: "#543828", label: "棕" },
  { id: "h2", color: "#2a2838", label: "黑" },
  { id: "h3", color: "#ac462e", label: "紅" },
  { id: "h4", color: "#d6a63c", label: "金" },
];
const HAIR_STYLES = [
  { id: "spiky", label: "刺刺" },
  { id: "short", label: "短髮" },
  { id: "long", label: "長髮" },
  { id: "tail", label: "馬尾" },
];
const FACES = [
  { id: "f1", label: "認真" },
  { id: "f2", label: "微笑" },
];
const SCALE = 5; // 64×64 放大 5 倍＝320px，整數倍像素才銳利

// 依完成期數決定要疊哪些圖層（由下到上）
function layersFor(track: Track, term: number, skin: string, hair: string, hairColor: string, face: string) {
  const L: string[] = [];
  if (term >= 4) L.push(`t4cape_${track}`);
  L.push(`outfit_${track}`);
  if (term >= 3) L.push(`t3_${track}`);
  L.push(`skin_${skin}_${face}`, `hair_${hair}_${hairColor}_${face}`);
  L.push(term >= 2 ? `t2_${track}` : `acc_${track}`);
  if (term >= 4) L.push(`t4sh_${track}`);
  if (term >= 1) L.push(`t1_${track}`);
  L.push(term >= 5 ? `t5_${track}` : `weapon0_${track}`);
  if (term >= 4) L.push("t4aura");
  return L.map((n) => `/avatar/${n}.png`);
}

export default function AvatarCreator({ trial = false }: { trial?: boolean }) {
  const [track, setTrack] = useState<Track>("eng");
  const [openPanel, setOpenPanel] = useState(false); // 手機版：角色設定是否展開
  const [skin, setSkin] = useState("s2");
  const [hair, setHair] = useState("spiky");
  const [hairColor, setHairColor] = useState("h1");
  const [face, setFace] = useState("f1");
  const [name, setName] = useState("小創客");
  const [term, setTerm] = useState(0);
  const [toast, setToast] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const prev = useRef(0);

  const t = TRACKS[track];
  const layers = layersFor(track, term, skin, hair, hairColor, face);
  const titled = term >= 4;

  // 期數往上加：跳出 RPG 對話框＋紙片
  useEffect(() => {
    const before = prev.current;
    prev.current = term;
    if (term <= before) return;
    const got = t.gear.slice(before, term);
    let msg = `完成第 ${term} 期！獲得「${got.join("、")}」`;
    if (before < 1 && term >= 1) msg += "　★ 可以轉職了！";
    if (before < 4 && term >= 4) msg += `　★ 稱號「${t.title}」`;
    setToast(msg);
    const r = stageRef.current?.getBoundingClientRect();
    if (r) burstConfetti(r.left + r.width / 2, r.top + r.height / 3, 60);
    const id = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(id);
  }, [term, t]);

  function changeTrack(k: Track) {
    setTrack(k);
    prev.current = term; // 換路線不重播解鎖通知
  }

  function randomize() {
    const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
    setSkin(pick(SKINS).id);
    setHair(pick(HAIR_STYLES).id);
    setHairColor(pick(HAIR_COLORS).id);
    setFace(pick(FACES).id);
  }

  // 存成圖片：把圖層依序畫到 canvas（關閉平滑，保持像素銳利）
  async function download() {
    const c = document.createElement("canvas");
    c.width = 720;
    c.height = 900;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, 0, 900);
    g.addColorStop(0, "#1e1a2e");
    g.addColorStop(1, "#3a2f4e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 720, 900);
    ctx.fillStyle = t.color + "55";
    ctx.beginPath();
    ctx.ellipse(360, 330, 260, 260, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.imageSmoothingEnabled = false;
    const imgs = await Promise.all(
      layers.map(
        (src) =>
          new Promise<HTMLImageElement>((res, rej) => {
            const im = new Image();
            im.onload = () => res(im);
            im.onerror = rej;
            im.src = src;
          }),
      ),
    );
    for (const im of imgs) ctx.drawImage(im, 40, 0, 640, 640);
    // RPG 對話框
    ctx.fillStyle = "rgba(14,12,24,0.92)";
    ctx.fillRect(30, 660, 660, 170);
    ctx.strokeStyle = "#fbc20f";
    ctx.lineWidth = 5;
    ctx.strokeRect(30, 660, 660, 170);
    ctx.fillStyle = "#fbc20f";
    ctx.font = "bold 44px sans-serif";
    ctx.fillText((name || "我的角色").slice(0, 8), 60, 720);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(`Lv.${1 + term * 3}　${titled ? t.title : t.novice}・${t.job}`, 60, 770);
    ctx.fillStyle = "#b8b4cc";
    ctx.font = "22px sans-serif";
    ctx.fillText(`完成 ${term} 期`, 60, 808);
    ctx.fillStyle = t.color;
    ctx.fillRect(0, 850, 720, 50);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("玩學院 Play Collegeee・playcollegeee.com", 360, 884);
    const a = document.createElement("a");
    a.download = `玩學院角色-${t.novice}.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  }

  return (
    <div className="ac" style={{ ["--ac" as string]: t.color, ["--ac-soft" as string]: `color-mix(in srgb, ${t.color} 16%, #fff)` }}>
      <div className="ac-stage ac-stage-px" ref={stageRef}>
        <div
          className="ac-sprite"
          role="img"
          aria-label={`${name || "我的角色"}，${t.novice}，完成 ${term} 期，已解鎖 ${term} 件裝備`}
          style={{ width: 64 * SCALE, height: 64 * SCALE }}
        >
          {layers.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" width={64 * SCALE} height={64 * SCALE} draggable={false} />
          ))}
        </div>
        <div className="ac-dialog">
          <div className="ac-dialog-name">
            <strong>{(name || "我的角色").slice(0, 8)}</strong>
            <span>
              Lv.{1 + term * 3}　{titled ? t.title : t.novice}・{t.job}
            </span>
          </div>
          <div className="ac-dialog-msg" role="status" aria-live="polite">
            {toast ? <span className="pop-in">▶ {toast}</span> : <span className="muted">▶ 完成 {term} 期・經驗值 {term * XP_PER_TERM}</span>}
          </div>
        </div>
        {/* 手機版：角色下方直接放按鈕 */}
        <div className="ac-quick">
          <span>完成 {term} 期</span>
          <button type="button" className="btn btn-sm primary" onClick={() => setTerm((n) => Math.min(MAX_TERM, n + 1))} disabled={term >= MAX_TERM}>
            {term >= MAX_TERM ? "裝備全開 ✓" : "＋ 完成一期"}
          </button>
        </div>
      </div>

      {/* 手機：捏角色的選項先收起來，首頁才不會太長 */}
      <button type="button" className="btn ac-more" aria-expanded={openPanel} aria-controls="ac-panel" onClick={() => setOpenPanel((v) => !v)}>
        {openPanel ? "收起角色設定 ▲" : "換路線、捏自己的角色 ▼"}
      </button>
      <div id="ac-panel" className={`ac-panel${openPanel ? "" : " folded"}`}>
        <fieldset className="ac-field">
          <legend>1. 選一條職業路線</legend>
          <div className="ac-tracks">
            {(Object.keys(TRACKS) as Track[]).map((k) => (
              <button
                key={k}
                type="button"
                className={`ac-track ${track === k ? "on" : ""}`}
                style={{ ["--c" as string]: TRACKS[k].color }}
                aria-pressed={track === k}
                onClick={() => changeTrack(k)}
              >
                <strong>{TRACKS[k].job}</strong>
                <small>{TRACKS[k].major}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="ac-field">
          <legend>2. 捏出你的{t.novice}</legend>
          <label className="ac-name">
            暱稱
            <input value={name} maxLength={8} onChange={(e) => setName(e.target.value)} placeholder="小創客" />
          </label>
          <div className="ac-row">
            <span>膚色</span>
            {SKINS.map((s) => (
              <button key={s.id} type="button" className={`ac-swatch ${skin === s.id ? "on" : ""}`} style={{ background: s.color }} aria-label={`膚色 ${s.id}`} aria-pressed={skin === s.id} onClick={() => setSkin(s.id)} />
            ))}
          </div>
          <div className="ac-row">
            <span>髮型</span>
            {HAIR_STYLES.map((h) => (
              <button key={h.id} type="button" className={`ac-chip ${hair === h.id ? "on" : ""}`} aria-pressed={hair === h.id} onClick={() => setHair(h.id)}>
                {h.label}
              </button>
            ))}
          </div>
          <div className="ac-row">
            <span>髮色</span>
            {HAIR_COLORS.map((h) => (
              <button key={h.id} type="button" className={`ac-swatch ${hairColor === h.id ? "on" : ""}`} style={{ background: h.color }} aria-label={`${h.label}色頭髮`} aria-pressed={hairColor === h.id} onClick={() => setHairColor(h.id)} />
            ))}
          </div>
          <div className="ac-row">
            <span>表情</span>
            {FACES.map((f) => (
              <button key={f.id} type="button" className={`ac-chip ${face === f.id ? "on" : ""}`} aria-pressed={face === f.id} onClick={() => setFace(f.id)}>
                {f.label}
              </button>
            ))}
            <button type="button" className="ac-chip" onClick={randomize}>🎲 隨機</button>
          </div>
        </fieldset>

        <fieldset className="ac-field">
          <legend>3. 完成一期，解鎖裝備</legend>
          <div className="ac-lessons">
            <button type="button" className="btn btn-sm" onClick={() => setTerm((n) => Math.max(0, n - 1))} disabled={term === 0} aria-label="少一期">−</button>
            <input type="range" min={0} max={MAX_TERM} value={term} onChange={(e) => setTerm(Number(e.target.value))} aria-label="完成期數" />
            <button type="button" className="btn btn-sm primary" onClick={() => setTerm((n) => Math.min(MAX_TERM, n + 1))} disabled={term >= MAX_TERM}>
              ＋ 完成一期
            </button>
          </div>
          <ul className="ac-gear">
            {t.gear.map((g, i) => (
              <li key={g} className={term > i ? "got" : ""}>
                <span>{term > i ? "✓" : "🔒"}</span> {g} <small>第 {i + 1} 期</small>
              </li>
            ))}
            <li className={titled ? "got" : ""}>
              <span>{titled ? "✓" : "🔒"}</span> 稱號「{t.title}」 <small>第 4 期</small>
            </li>
          </ul>
        </fieldset>

        <fieldset className="ac-field">
          <legend>4. 轉職：6 種職業等你解鎖</legend>
          <ul className="ac-jobs">
            {t.jobs.map((j, i) => (
              <li key={j}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/avatar/sil_${track}_${"abcdef"[i]}.png`} alt={`${j}（尚未解鎖的剪影）`} width={96} height={96} />
                <strong>{j}</strong>
                <small>🔒 完成第 1 期</small>
              </li>
            ))}
          </ul>
          <p className="hint">
            {term >= 1
              ? "★ 可以轉職了！真正的轉職要在教室完成第 1 期後解鎖，自己挑想當的職業。"
              : "在教室完成第 1 期，就能從這 6 種職業裡挑一種轉職。"}
            （試玩用的示意規則）
          </p>
        </fieldset>

        <div className="btn-row">
          {trial ? (
            <Link href={`/contact?type=trial&major=${t.majorKey}`} className="btn primary">
              讓角色真的長大：預約試聽
            </Link>
          ) : (
            <Link href="/courses" className="btn primary">
              看這條路線的主修課程
            </Link>
          )}
          <button type="button" className="btn" onClick={download}>存成圖片</button>
        </div>
        <p className="hint">暱稱與外觀只留在你的瀏覽器裡，不會上傳。</p>
      </div>
    </div>
  );
}

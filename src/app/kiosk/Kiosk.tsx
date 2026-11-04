"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { burstConfetti } from "@/lib/confetti";

// 讀卡站畫面：
//   1. USB 讀卡機：刷卡時會像鍵盤一樣打出卡號＋Enter，這裡在背景接收
//   2. Android 手機：按「啟用手機 NFC」後直接感應（Chrome 的 Web NFC）
// 畫面上只顯示角色暱稱，不顯示真實姓名。

type Item = { code: string; name: string; slot: string; rarity: string; image: string | null };
type Result = {
  result: string;
  who?: "student" | "teacher";
  nickname?: string;
  name?: string;
  class?: string;
  status?: string;
  items?: Item[];
  xp?: { track: string; xp: number }[];
  uid?: string;
  message?: string;
};

const TRACK: Record<string, string> = { lego: "機關工程師", "3d": "造物工匠", art: "色彩魔法師" };

function view(r: Result): { tone: "ok" | "info" | "warn"; title: string; sub?: string } {
  const n = r.nickname ?? "";
  switch (r.result) {
    case "checkin":
      return r.status === "late"
        ? { tone: "ok", title: `${n}，歡迎！`, sub: `${r.class ?? ""}・快進教室，大家在等你` }
        : { tone: "ok", title: `哈囉 ${n}！`, sub: r.class };
    case "checkout": return { tone: "info", title: `${n} 下課囉，掰掰！`, sub: "今天辛苦了，下次見" };
    case "already": return { tone: "info", title: `${n} 已經簽到囉`, sub: r.class };
    case "no_session": return { tone: "warn", title: `${n} 你好！`, sub: "現在沒有你的課，請找老師幫忙" };
    case "teacher_in": return { tone: "ok", title: `${r.name} 早安！`, sub: "已記錄上班時間" };
    case "teacher_out": return { tone: "info", title: `${r.name} 辛苦了！`, sub: "已記錄下班時間" };
    case "unknown": return { tone: "warn", title: "這張卡還沒登記", sub: "請老師到後台「卡片」綁定" };
    case "revoked": return { tone: "warn", title: "這張卡已經停用", sub: "請找老師幫忙" };
    case "unauthorized": return { tone: "warn", title: "讀卡站已被停用", sub: "請管理員重新設定" };
    default: return { tone: "warn", title: "沒有讀到，請再刷一次", sub: r.message };
  }
}

// 簡單的提示音（不需要音效檔）
function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = ok ? [880, 1320] : [330, 220];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = "triangle";
      g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.12);
      o.stop(ctx.currentTime + i * 0.12 + 0.2);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {}
}

export default function Kiosk({ deviceName }: { deviceName: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [nfc, setNfc] = useState<"none" | "available" | "on" | "error">("none");
  const [log, setLog] = useState<{ t: string; text: string }[]>([]);
  const buf = useRef("");
  const lastKey = useRef(0);
  const lastUid = useRef({ uid: "", at: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const submit = useCallback(async (raw: string) => {
    const uid = raw.trim();
    if (uid.length < 4) return;
    // 同一張卡 3 秒內重複感應就忽略
    if (lastUid.current.uid === uid && Date.now() - lastUid.current.at < 3000) return;
    lastUid.current = { uid, at: Date.now() };
    setBusy(true);
    let r: Result;
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });
      r = (await res.json()) as Result;
    } catch {
      r = { result: "error", message: "網路好像斷了，請再刷一次" };
    }
    setBusy(false);
    setResult(r);
    const good = ["checkin", "checkout", "already", "teacher_in", "teacher_out"].includes(r.result);
    beep(good);
    if (r.result === "checkin") burstConfetti(undefined, undefined, r.items?.length ? 140 : 80);
    const v = view(r);
    setLog((l) => [{ t: new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }), text: v.title }, ...l].slice(0, 6));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setResult(null), r.items?.length ? 8000 : 5000);
  }, []);

  // 時鐘
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  // USB 讀卡機（鍵盤模式）：快速連續輸入的字元＋Enter＝一次刷卡
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = Date.now();
      if (t - lastKey.current > 300) buf.current = "";
      lastKey.current = t;
      if (e.key === "Enter") {
        const v = buf.current;
        buf.current = "";
        if (v) { e.preventDefault(); submit(v); }
      } else if (e.key.length === 1 && /[0-9A-Za-z:\-]/.test(e.key)) {
        buf.current += e.key;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  useEffect(() => {
    if ("NDEFReader" in window) setNfc("available");
  }, []);

  const startNfc = async () => {
    try {
      // @ts-expect-error Web NFC 目前只有 Android 版 Chrome 支援，TypeScript 沒有內建型別
      const reader = new window.NDEFReader();
      await reader.scan();
      reader.addEventListener("reading", (e: { serialNumber: string }) => submit(e.serialNumber));
      setNfc("on");
    } catch {
      setNfc("error");
    }
  };

  const v = result ? view(result) : null;
  return (
    <main className={`kiosk ${v ? `kiosk-${v.tone}` : ""}`}>
      <header className="kiosk-top">
        <span className="kiosk-brand"><img src="/brand/logo-icon.png" alt="" width={40} height={40} />玩學院 Play Collegeee</span>
        <span className="kiosk-clock">{now?.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
      </header>

      <section className="kiosk-stage" aria-live="assertive">
        {!v && (
          <div className="kiosk-idle">
            <div className="kiosk-card" aria-hidden="true"><span /></div>
            <h1>{busy ? "讀取中…" : "請刷卡"}</h1>
            <p>把卡片靠近讀卡機</p>
          </div>
        )}
        {v && result && (
          <div className="kiosk-result" key={lastUid.current.at}>
            <h1>{v.title}</h1>
            {v.sub && <p className="kiosk-sub">{v.sub}</p>}
            {result.items && result.items.length > 0 && (
              <div className="kiosk-loot">
                <p>今天解鎖</p>
                <ul>
                  {result.items.map((it) => (
                    <li key={it.code} className={`rarity-${it.rarity}`}>
                      {it.image && /^(https:\/\/|\/)/.test(it.image) ? <img src={it.image} alt="" /> : <span className="kiosk-gem" aria-hidden="true" />}
                      {it.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.result === "checkin" && result.xp && result.xp.length > 0 && (
              <ul className="kiosk-xp">
                {result.xp.map((x) => <li key={x.track}>{TRACK[x.track] ?? x.track}<b>{x.xp}</b> XP</li>)}
              </ul>
            )}
            {result.result === "unknown" && result.uid && <p className="kiosk-uid">卡號 {result.uid}</p>}
          </div>
        )}
      </section>

      <footer className="kiosk-foot">
        <span>{deviceName}</span>
        {nfc === "available" && <button className="btn btn-sm" onClick={startNfc}>啟用手機 NFC</button>}
        {nfc === "on" && <span>手機 NFC 感應中</span>}
        {nfc === "error" && <span>無法啟用 NFC，請確認手機已開啟 NFC</span>}
        {log.length > 0 && <span className="kiosk-log">{log.map((l) => `${l.t} ${l.text}`).join("　")}</span>}
      </footer>
    </main>
  );
}

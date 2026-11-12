"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RATE, decodeMono16k, encodeWav, splitPoints } from "@/lib/audioChunks";
import { attachRecording, createMeeting, meetingProgress, summarizeMeeting, transcribePart } from "./meetingActions";

export type Phase = { step: "idle" | "decoding" | "sending" | "summarizing" | "done" | "error"; done?: number; total?: number; text?: string };
export const today = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

// 匯入手機錄音 → 瀏覽器切段 → 一段一段轉文字 → AI 整理摘要、決議、待辦（規劃頁與會議室共用）
// 新會議（沒事先安排）自動編號「第 X 次會議」、日期為今天，之後在會議室可以改
export function useRecorder(planId: string | null, onCreated?: (id: string) => void) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [resumeId, setResumeId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = ["decoding", "sending", "summarizing"].includes(phase.step);

  async function run(file: File, existingId?: string, plannedId?: string) {
    let lock: { release: () => Promise<void> } | null = null;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    try {
      // 處理中讓螢幕不要關（瀏覽器支援才會生效）
      lock = await (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } })
        .wakeLock?.request("screen").catch(() => null) ?? null;
      setPhase({ step: "decoding", text: "正在讀取錄音檔…（長的錄音要等 10–30 秒）" });
      let samples: Float32Array;
      try { samples = await decodeMono16k(file); } catch {
        throw new Error("讀不出這個錄音檔。請用 m4a、mp3、wav 格式，或改用電腦匯入（手機記憶體可能不夠）");
      }
      const points = splitPoints(samples);
      const duration = samples.length / RATE;
      if (duration < 5) throw new Error("錄音太短了");
      let id = existingId;
      let done = new Set<number>();
      if (id) {
        const p = await meetingProgress(id);
        if (!p.ok) throw new Error(p.message ?? "讀取進度失敗");
        if (p.total !== points.length) throw new Error("這不是同一個錄音檔（長度不同），請選原本匯入的那個檔案");
        done = new Set(p.done);
      } else if (plannedId) {
        // 事先安排好的會議：把錄音接上去
        const r = await attachRecording({ meetingId: plannedId, partsTotal: points.length, durationSec: duration, consent: true });
        if (!r.ok) throw new Error(r.message);
        id = plannedId;
      } else {
        if (!planId) throw new Error("找不到這份規劃");
        const r = await createMeeting({ planId, title: "", heldOn: today(), partsTotal: points.length, durationSec: duration, consent: true });
        if (!r.ok || !r.id) throw new Error(r.message);
        id = r.id;
        onCreated?.(r.id);
      }
      setResumeId(id);
      for (let i = 0; i < points.length; i++) {
        if (done.has(i)) continue;
        setPhase({ step: "sending", done: done.size, total: points.length });
        const [s, e] = points[i];
        const fd = new FormData();
        fd.set("meetingId", id);
        fd.set("idx", String(i));
        fd.set("audio", encodeWav(samples.subarray(s, e)), `part${i}.wav`);
        let r = await transcribePart(fd);
        if (!r.ok) { await new Promise((ok) => setTimeout(ok, 3000)); r = await transcribePart(fd); } // 失敗自動重試一次
        if (!r.ok) throw new Error(`${r.message}（已完成 ${done.size}／${points.length} 段，可以按「繼續」選同一個錄音檔接著做）`);
        done.add(i);
      }
      setPhase({ step: "summarizing", text: "AI 正在整理摘要、決議和待辦…（約 20–50 秒）" });
      const r = await summarizeMeeting(id);
      if (!r.ok) throw new Error(`${r.message}（逐字稿已完成，可以在下面按「重新整理」）`);
      setPhase({ step: "done", text: "完成！請在下面查看摘要，勾選要套用的決議與待辦。" });
      setResumeId(null);
      router.refresh();
    } catch (e) {
      setPhase({ step: "error", text: e instanceof Error ? e.message : "處理失敗，請再試一次" });
      router.refresh();
    } finally {
      window.removeEventListener("beforeunload", guard);
      void lock?.release().catch(() => {});
      if (fileRef.current) fileRef.current.value = "";
    }
  }


  const pick = (existingId?: string, plannedId?: string) => {
    const input = fileRef.current;
    if (!input) return;
    input.onchange = () => { const f = input.files?.[0]; if (f) void run(f, existingId, plannedId); };
    input.click();
  };
  const fileInput = <input ref={fileRef} type="file" accept="audio/*,.m4a,.mp3,.wav,.aac,.amr,.3gp,.ogg,.webm" hidden />;
  return { phase, busy, resumeId, pick, fileInput };
}

export function PhaseBox({ phase, resumeId, pick }: { phase: Phase; resumeId: string | null; pick: (id?: string) => void }) {
  if (phase.step === "idle") return null;
  return (
    <div className={`pln-meet-phase ${phase.step}`} role="status">
      {phase.step === "sending" ? (
        <>
          <p>正在轉成文字：{phase.done}／{phase.total} 段（每段約 1.5 分鐘）</p>
          <progress max={phase.total} value={phase.done} />
        </>
      ) : <p>{phase.text}</p>}
      {phase.step === "error" && resumeId && (
        <button type="button" className="btn btn-sm" onClick={() => pick(resumeId)}>▶ 繼續（選同一個錄音檔）</button>
      )}
    </div>
  );
}

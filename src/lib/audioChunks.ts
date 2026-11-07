// 在瀏覽器把手機錄音（m4a、mp3、wav…）轉成 16 kHz 單聲道，切成約 1.5 分鐘的小段 WAV
// 每段約 2.9 MB：低於網站單次上傳 4 MB 的限制，也低於語音轉文字單次 25 MB 的限制
// 切點挑在 80～90 秒之間最安靜的地方，比較不會把一句話切斷

export const RATE = 16000;
const TARGET = 90; // 每段最長秒數
const SEARCH = 10; // 往前找安靜點的範圍（秒）

export async function decodeMono16k(file: Blob): Promise<Float32Array> {
  const buf = await file.arrayBuffer();
  let audio: AudioBuffer;
  try {
    // 直接用 16 kHz 解碼（瀏覽器會自動轉取樣率），比較省記憶體
    const ctx = new AudioContext({ sampleRate: RATE });
    try { audio = await ctx.decodeAudioData(buf.slice(0)); } finally { void ctx.close(); }
  } catch {
    const ctx = new AudioContext();
    try { audio = await ctx.decodeAudioData(buf); } finally { void ctx.close(); }
  }
  // 轉成單聲道 16 kHz
  if (audio.sampleRate === RATE && audio.numberOfChannels === 1) return audio.getChannelData(0);
  const off = new OfflineAudioContext(1, Math.ceil(audio.duration * RATE), RATE);
  const src = off.createBufferSource();
  src.buffer = audio;
  src.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  return out.getChannelData(0);
}

// 回傳每段的 [開始, 結束) 取樣位置
export function splitPoints(samples: Float32Array): [number, number][] {
  const out: [number, number][] = [];
  const win = RATE / 10; // 100 毫秒為一格算音量
  let start = 0;
  while (start < samples.length) {
    let end = Math.min(samples.length, start + TARGET * RATE);
    if (end < samples.length) {
      let best = end;
      let bestE = Infinity;
      for (let p = end - SEARCH * RATE; p + win <= end; p += win) {
        let e = 0;
        for (let i = p; i < p + win; i++) e += samples[i] * samples[i];
        if (e < bestE) { bestE = e; best = p + win / 2; }
      }
      end = Math.floor(best);
    }
    out.push([start, end]);
    start = end;
  }
  return out;
}

export function encodeWav(samples: Float32Array): Blob {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

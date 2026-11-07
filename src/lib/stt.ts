// 語音轉文字（OpenAI Transcriptions API，只在伺服器端使用）
// 金鑰放在 Vercel 環境變數 OPENAI_API_KEY，不寫進程式；模型可用 OPENAI_TRANSCRIBE_MODEL 換（預設 gpt-4o-transcribe）
// 單次上限約 25 MB／25 分鐘，所以錄音在瀏覽器先切成 1.5 分鐘的小段（見 src/lib/audioChunks.ts）
// OPENAI_BASE_URL 只在本機測試時用（指向模擬伺服器）

const API = `${process.env.OPENAI_BASE_URL || "https://api.openai.com"}/v1/audio/transcriptions`;
export const STT_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe";
export const sttConfigured = () => !!process.env.OPENAI_API_KEY;

// 常用詞提示：讓專有名詞比較不會聽錯
const VOCAB = "玩學院、Play Collegeee、樂高、LEGO、SPIKE、BricQ、3D 列印、積木故事屋、樂高動滋動、走讀、工作坊、玩寶、玩童、玩樂、玩創、玩家、教案";

export async function transcribe(audio: Blob, prevText = ""): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("還沒設定語音轉文字的金鑰（Vercel 環境變數 OPENAI_API_KEY）");
  const fd = new FormData();
  fd.set("file", audio, "part.wav");
  fd.set("model", STT_MODEL);
  fd.set("language", "zh");
  fd.set("response_format", "json");
  // 提示：常用詞＋上一段的結尾，讓接段比較順、使用繁體中文
  fd.set("prompt", `以下是台灣兒童 STEAM 教室老師的會議，請用繁體中文。常用詞：${VOCAB}。${prevText.slice(-200)}`);
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: fd,
    signal: AbortSignal.timeout(55_000),
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = j.error?.message ?? "";
    } catch {}
    if (res.status === 401) throw new Error("語音轉文字金鑰無效，請到 Vercel 檢查 OPENAI_API_KEY");
    if (res.status === 429 && /quota|billing|credit/i.test(detail)) throw new Error("語音轉文字額度不足，請到 OpenAI 儲值");
    if (res.status === 429) throw new Error("語音轉文字太頻繁，請稍後再按「繼續」");
    if (res.status >= 500) throw new Error("語音轉文字服務暫時忙碌，請稍後再按「繼續」");
    throw new Error(`語音轉文字失敗（${res.status}）${detail ? `：${detail.slice(0, 200)}` : ""}`);
  }
  const j = (await res.json()) as { text?: string };
  return (j.text ?? "").trim();
}

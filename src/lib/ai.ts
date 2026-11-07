// 呼叫 Claude API（只在伺服器端使用；金鑰放在 Vercel 環境變數 ANTHROPIC_API_KEY，不寫進程式）
// 用「嚴格工具」（strict）要 Claude 回傳固定格式的 JSON：Claude Sonnet 5.5 不支援強制指定工具（tool_choice: tool），
// 改用 tool_choice: auto＋strict，並在提示裡要求一定要呼叫工具。
// 嚴格工具的 schema：每個 object 都要 additionalProperties: false，所有欄位都列在 required。

// ANTHROPIC_BASE_URL 只在本機測試時用（指向模擬伺服器），正式站不用設
const API = `${process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`;
const VERSION = "2026-10-21";
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

type Content =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export async function askForJson<T>(opts: {
  system: string;
  content: Content[];
  toolName: string;
  toolDescription: string;
  schema: object;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<T> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("還沒設定 AI 金鑰（Vercel 環境變數 ANTHROPIC_API_KEY）");
  const body = {
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
    tools: [{ name: opts.toolName, description: opts.toolDescription, input_schema: opts.schema, strict: true }],
    tool_choice: { type: "auto" },
    // 不先長考，直接寫（比較快；Sonnet 5.5 不能關閉思考，between_tools 是最低設定）
    thinking: { type: "between_tools" },
  };
  const send = (b: object) =>
    fetch(API, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": VERSION, "content-type": "application/json" },
      body: JSON.stringify(b),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 55_000),
      cache: "no-store",
    });
  let res = await send(body);
  // 換模型時（例如用 ANTHROPIC_MODEL 換成不支援這個思考設定的模型）可能回 400，拿掉思考設定再試一次
  if (res.status === 400) {
    const { thinking: _omit, ...rest } = body;
    void _omit;
    const retry = await send(rest);
    if (retry.ok) res = retry;
  }
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = j.error?.message ?? "";
    } catch {}
    if (res.status === 401) throw new Error("AI 金鑰無效，請到 Vercel 檢查 ANTHROPIC_API_KEY");
    if (res.status === 402 || /credit|balance|billing/i.test(detail)) throw new Error("AI 額度不足，請到 Claude Console 儲值或調高花費上限");
    if (res.status === 429) throw new Error("AI 使用太頻繁，請稍後再試");
    if (res.status >= 500) throw new Error("AI 服務暫時忙碌，請稍後再試");
    // 其他錯誤把 Claude 回傳的原因一起顯示（不含金鑰），方便除錯
    throw new Error(`AI 呼叫失敗（${res.status}）${detail ? `：${detail.slice(0, 200)}` : ""}`);
  }
  const data = (await res.json()) as { content?: { type: string; name?: string; input?: unknown }[] };
  const tool = data.content?.find((c) => c.type === "tool_use" && c.name === opts.toolName);
  if (!tool?.input) throw new Error("AI 這次沒有照格式回覆，請再按一次");
  return tool.input as T;
}

// 參考網址及檔案（migration 0024）共用常數與型別。瀏覽器元件也會引用，這裡不要引入伺服器專用的東西。

export const REF_BUCKET = "plan-files";
export const REF_MAX_BYTES = 20 * 1024 * 1024; // 單檔 20 MB（和 bucket 設定一致）
export const REF_MAX_FILES = 10; // 一次最多選 10 個檔案

export type PlanRef = {
  id: string; plan_id: string; meeting_id: string | null; kind: "link" | "file";
  title: string; url: string | null; file_name: string | null; file_size: number | null; mime: string | null;
  created_by: string | null; created_at: string;
  author?: { name: string; nickname: string | null } | null;
  meeting?: { id: string; title: string } | null;
};

export const fmtSize = (n: number | null) =>
  !n ? "" : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

// 依副檔名給個小圖示
export function fileIcon(name: string | null) {
  const ext = (name ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "🖼️";
  if (ext === "pdf") return "📕";
  if (["doc", "docx", "odt", "txt", "md"].includes(ext)) return "📄";
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "📊";
  if (["ppt", "pptx", "key", "odp"].includes(ext)) return "📽️";
  if (["mp4", "mov", "m4v", "webm"].includes(ext)) return "🎬";
  if (["mp3", "m4a", "wav"].includes(ext)) return "🎵";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
  if (["io", "stl", "3mf", "obj", "gcode"].includes(ext)) return "🧱";
  return "📎";
}

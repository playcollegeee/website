"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isImageFile, isIoFile, sendModel, sendPhoto } from "../uploadClient";

type Lesson = { id: string; title: string; category_id: string | null };
type Group = { folder: string; images: File[]; ios: File[]; lessonId: string };

// 比對用：去掉空白與標點，例如「小勇者-劍與盾」對到「小勇者：劍與盾」
const norm = (s: string) => s.replace(/[\s\-—_：:（）()【】\[\]「」・.,，、!！?？]/g, "").toLowerCase();

function guess(folder: string, lessons: Lesson[]): string {
  const f = norm(folder);
  if (f.length < 2) return "";
  const exact = lessons.filter((l) => norm(l.title) === f);
  if (exact.length === 1) return exact[0].id;
  const partial = lessons.filter((l) => {
    const t = norm(l.title);
    return t.length >= 2 && (t.includes(f) || f.includes(t));
  });
  return partial.length === 1 ? partial[0].id : "";
}

// 同一個資料夾裡，檔名和資料夾同名的照片排第一個（會當封面）
const byName = (folder: string) => (a: File, b: File) => {
  const base = (f: File) => f.name.replace(/\.[^.]+$/, "");
  const sa = base(a) === folder ? 0 : 1;
  const sb = base(b) === folder ? 0 : 1;
  return sa - sb || a.name.localeCompare(b.name, "zh-Hant");
};

export default function BulkImport({
  categories, defaultCategory, lessons, existing,
}: {
  categories: { id: string; label: string }[];
  defaultCategory: string;
  lessons: Lesson[];
  existing: Record<string, string[]>;
}) {
  const router = useRouter();
  const [category, setCategory] = useState(defaultCategory);
  const [groups, setGroups] = useState<Group[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [log, setLog] = useState<{ ok: boolean; message: string }[]>([]);
  const [, start] = useTransition();

  const inCat = useMemo(() => lessons.filter((l) => l.category_id === category), [lessons, category]);

  function pick(list: FileList | null) {
    if (!list) return;
    const map = new Map<string, Group>();
    let other = 0;
    for (const file of [...list]) {
      const parts = (file.webkitRelativePath || file.name).split("/");
      const folder = parts.length >= 2 ? parts[parts.length - 2] : "";
      const img = isImageFile(file);
      const io = isIoFile(file);
      if (!folder || (!img && !io)) {
        other++;
        continue;
      }
      const g = map.get(folder) ?? { folder, images: [], ios: [], lessonId: "" };
      (img ? g.images : g.ios).push(file);
      map.set(folder, g);
    }
    const gs = [...map.values()]
      .map((g) => ({ ...g, images: g.images.sort(byName(g.folder)), lessonId: guess(g.folder, inCat) }))
      .sort((a, b) => Number(!a.lessonId) - Number(!b.lessonId) || a.folder.localeCompare(b.folder, "zh-Hant"));
    setGroups(gs);
    setSkipped(other);
    setLog([]);
  }

  const setLesson = (folder: string, id: string) =>
    setGroups((all) => all.map((g) => (g.folder === folder ? { ...g, lessonId: id } : g)));

  // 已經在教案裡的同名檔案不再上傳
  const pending = (g: Group) => {
    const have = new Set(existing[g.lessonId] ?? []);
    return { images: g.images.filter((f) => !have.has(f.name)), ios: g.ios.filter((f) => !have.has(f.name)) };
  };
  const todo = groups.filter((g) => g.lessonId);
  const total = todo.reduce((n, g) => n + pending(g).images.length + pending(g).ios.length, 0);

  async function run() {
    if (!total) return;
    setRunning(true);
    const out: { ok: boolean; message: string }[] = [];
    let i = 0;
    for (const g of todo) {
      const { images, ios } = pending(g);
      for (const f of images) {
        setProgress(`${++i}／${total}　${g.folder}／${f.name}`);
        const r = await sendPhoto(g.lessonId, f);
        if (!r.ok) out.push({ ok: false, message: `${g.folder}：${r.message}` });
      }
      for (const f of ios) {
        setProgress(`${++i}／${total}　${g.folder}／${f.name}`);
        const r = await sendModel(g.lessonId, f);
        if (!r.ok) out.push({ ok: false, message: `${g.folder}：${r.message}` });
      }
    }
    setRunning(false);
    setProgress("");
    setLog([{ ok: out.length === 0, message: `完成：處理 ${total} 個檔案${out.length ? `，${out.length} 個失敗` : ""}` }, ...out]);
    start(() => router.refresh());
  }

  return (
    <div className="adm-panel">
      <div className="adm-inline-form">
        <select value={category} onChange={(e) => { setCategory(e.target.value); setGroups([]); }} aria-label="課程類別" disabled={running}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <label className="btn btn-sm">
          📁 選擇資料夾
          <input
            type="file" multiple hidden disabled={running}
            // 選整個資料夾（Chrome／Edge／Safari 都支援）
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            onChange={(e) => pick(e.target.files)}
          />
        </label>
        <small className="hint">此類別有 {inCat.length} 個教案</small>
      </div>

      {groups.length > 0 && (
        <>
          <table className="adm-table lsn-import">
            <thead>
              <tr><th>資料夾</th><th>照片</th><th>.io</th><th>對應教案</th></tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const p = g.lessonId ? pending(g) : null;
                return (
                  <tr key={g.folder} className={g.lessonId ? "" : "muted"}>
                    <td>{g.folder}</td>
                    <td>{p ? `${p.images.length}` : g.images.length}{p && p.images.length < g.images.length && <small>（{g.images.length - p.images.length} 已有）</small>}</td>
                    <td>{p ? `${p.ios.length}` : g.ios.length}{p && p.ios.length < g.ios.length && <small>（{g.ios.length - p.ios.length} 已有）</small>}</td>
                    <td>
                      <select value={g.lessonId} onChange={(e) => setLesson(g.folder, e.target.value)} disabled={running} aria-label={`${g.folder} 對應教案`}>
                        <option value="">（不匯入）</option>
                        {inCat.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="hint">
            {todo.length} 個資料夾對應到教案，共 {total} 個檔案要上傳{skipped ? `；已略過 ${skipped} 個 PDF、Word 等其他檔案` : ""}。
          </p>
          <button type="button" className="btn primary" onClick={run} disabled={running || total === 0}>
            {running ? "上傳中…" : `開始上傳 ${total} 個檔案`}
          </button>
        </>
      )}

      {(progress || log.length > 0) && (
        <div className="lsn-upload-status" role="status" aria-live="polite">
          {progress && <p>上傳中 {progress}（請不要關閉這個頁面）</p>}
          {log.map((m, i) => <p key={i} className={m.ok ? "" : "err"}>{m.ok ? "✓" : "⚠"} {m.message}</p>)}
          {!running && log.length > 0 && <p><Link href="/admin/lessons">到教案庫看看 →</Link></p>}
        </div>
      )}
    </div>
  );
}

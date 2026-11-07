import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet, sbSignUrls } from "@/lib/supabase";
import { fmtDate, fmtTime } from "@/lib/admin";
import {
  LESSON_BUCKET, LESSON_STATUS, PHASES, TAG_KINDS, canEditLesson, categoryLabel, levelsLabel, materialsOf, stars, stepsOf, type Tag,
} from "@/lib/lessons";
import { setLessonStatus } from "../actions";
import PrintButton from "../PrintButton";
import LessonFiles from "../LessonFiles";
import { EXPORT_FORMATS } from "@/lib/lessonExport";

export const metadata = { title: "教案" };

type L = {
  id: string; title: string; levels: string[]; difficulty: number | null; minutes: number; summary: string | null;
  goals: string | null; refs: string | null; timeline: unknown; challenge: string | null; support: string | null;
  materials: unknown; tips: string | null; xp: number; status: string; version: number; author_id: string | null;
  parent_note: string | null; outline: string | null;
  created_at: string; updated_at: string;
  category: { major: string; name: string } | null;
  author: { name: string; nickname: string | null } | null;
  editor: { name: string; nickname: string | null } | null;
  lesson_tags: { tags: Tag }[];
};
type S = { id: string; starts_at: string; classes: { id: string; name: string } };
type F = {
  id: string; kind: string; storage_path: string; thumb_path: string | null; file_name: string | null;
  size_bytes: number | null; is_cover: boolean; uploaded_by: string | null;
};

// 多行文字：網址變成可點的連結
function Text({ v }: { v: string | null }) {
  if (!v) return <span className="muted">—</span>;
  return (
    <div className="lsn-text">
      {v.split("\n").map((line, i) => {
        const t = line.trim();
        return (
          <p key={i}>
            {/^https?:\/\/\S+$/.test(t) ? <a href={t} target="_blank" rel="noopener noreferrer">{t}</a> : line || " "}
          </p>
        );
      })}
    </div>
  );
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [rows, sessions, files] = await Promise.all([
    sbGet<L[]>(
      `lessons?id=eq.${id}&select=id,title,levels,difficulty,minutes,summary,goals,refs,timeline,challenge,support,materials,tips,xp,status,version,author_id,parent_note,outline,created_at,updated_at,` +
        `category:lesson_categories(major,name),author:teachers!lessons_author_id_fkey(name,nickname),editor:teachers!lessons_updated_by_fkey(name,nickname),` +
        `lesson_tags(tags(id,kind,name))`,
    ),
    sbGet<S[]>(`sessions?lesson_id=eq.${id}&select=id,starts_at,classes(id,name)&order=starts_at.desc&limit=50`),
    sbGet<F[]>(
      `lesson_files?lesson_id=eq.${id}&kind=in.(image,model_io)&select=id,kind,storage_path,thumb_path,file_name,size_bytes,is_cover,uploaded_by&order=sort`,
    ),
  ]);
  const l = rows[0];
  if (!l) notFound();
  const editable = canEditLesson(staff, l.author_id);
  // 照片在私人空間：產生 1 小時有效的連結（縮圖給照片牆、大圖給放大檢視）
  const images = files.filter((f) => f.kind === "image").sort((a, b) => Number(b.is_cover) - Number(a.is_cover));
  const signed = await sbSignUrls(LESSON_BUCKET, images.flatMap((f) => [f.storage_path, f.thumb_path ?? f.storage_path]));
  const manage = (f: F) => editable || (f.uploaded_by !== null && f.uploaded_by === staff.id);
  const photos = images.map((f) => ({
    id: f.id, name: f.file_name ?? "照片", is_cover: f.is_cover, canManage: manage(f),
    full: signed.get(f.storage_path) ?? null, thumb: signed.get(f.thumb_path ?? f.storage_path) ?? null,
  }));
  const models = files.filter((f) => f.kind === "model_io").map((f) => ({
    id: f.id, name: f.file_name ?? "model.io", size: f.size_bytes, canManage: manage(f),
  }));
  const steps = stepsOf(l.timeline);
  const materials = materialsOf(l.materials);
  const tags = l.lesson_tags.map((x) => x.tags);
  const total = steps.reduce((n, s) => n + (s.min ?? 0), 0);
  const st = LESSON_STATUS[l.status] ?? LESSON_STATUS.draft;
  const now = Date.now();
  const past = sessions.filter((s) => new Date(s.starts_at).getTime() < now);
  const upcoming = sessions.filter((s) => new Date(s.starts_at).getTime() >= now).reverse();
  const who = (t: { name: string; nickname: string | null } | null) => (t ? t.nickname ?? t.name : "—");

  return (
    <>
      <div className="adm-head">
        <h1>
          {l.title}
          <span className={`tag ${st.tag}`}>{st.label}</span>
        </h1>
        <div className="adm-actions lsn-noprint">
          <Link href="/admin/lessons" className="adm-link">← 教案庫</Link>
          <details className="adm-pop lsn-export">
            <summary className="btn btn-sm">📄 匯出 Word</summary>
            <ul>
              {(Object.keys(EXPORT_FORMATS) as (keyof typeof EXPORT_FORMATS)[]).map((f) => (
                <li key={f}>
                  <a href={`/admin/lessons/${id}/export/${f}`}>{EXPORT_FORMATS[f].label}</a>
                  <small>{EXPORT_FORMATS[f].hint}</small>
                </li>
              ))}
            </ul>
          </details>
          <PrintButton />
          {editable && <Link href={`/admin/lessons/${id}/edit`} className="btn btn-sm primary">編輯</Link>}
        </div>
      </div>

      <div className="adm-panel lsn-meta">
        <dl>
          <div><dt>類別</dt><dd>{categoryLabel(l.category)}</dd></div>
          <div><dt>階段</dt><dd>{levelsLabel(l.levels)}</dd></div>
          <div><dt>時長</dt><dd>{l.minutes} 分鐘</dd></div>
          <div><dt>難易度</dt><dd className="lsn-stars">{stars(l.difficulty)}</dd></div>
          <div><dt>經驗值</dt><dd>{l.xp}</dd></div>
          <div><dt>作者</dt><dd>{who(l.author)}</dd></div>
          <div><dt>最後修改</dt><dd>{fmtDate(l.updated_at)} {who(l.editor)}</dd></div>
        </dl>
        {l.summary && <p className="lsn-summary">{l.summary}</p>}
        {tags.length > 0 && (
          <div className="lsn-tagrows">
            {TAG_KINDS.map((k) => {
              const ts = tags.filter((t) => t.kind === k.value);
              if (!ts.length) return null;
              return (
                <div key={k.value}>
                  <span className="lsn-tagkind">{k.label}</span>
                  {ts.map((t) => (
                    <Link key={t.id} href={`/admin/lessons?tag=${t.id}`} className={`lsn-chip lsn-chip-${t.kind}`}>{t.name}</Link>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <LessonFiles lessonId={id} photos={photos} models={models} />

      <section className="adm-panel">
        <h2>學習目標</h2>
        <Text v={l.goals} />
      </section>

      <section className="adm-panel">
        <h2>教學流程 <small>共 {total || "—"} 分鐘</small></h2>
        {l.refs && (
          <div className="lsn-refs">
            <strong>前導引導的參考資料</strong>
            <Text v={l.refs} />
          </div>
        )}
        {steps.length === 0 && <p className="adm-empty">還沒有填寫流程。</p>}
        {PHASES.map((p) => {
          const ps = steps.filter((s) => s.phase === p.value);
          if (!ps.length) return null;
          return (
            <div key={p.value} className={`lsn-phase lsn-phase-${p.value}`}>
              <h3>{p.label}</h3>
              <ol className="lsn-timeline">
                {ps.map((s, i) => (
                  <li key={i}>
                    <span className="lsn-min-badge">{s.min ? `${s.min} 分` : "—"}</span>
                    <div>
                      {s.title && <strong>{s.title}</strong>}
                      {s.teacher && <div className="lsn-who"><em>老師</em><Text v={s.teacher} /></div>}
                      {s.students && <div className="lsn-who"><em>孩子</em><Text v={s.students} /></div>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </section>

      <div className="adm-cols">
        <section className="adm-panel">
          <h2>差異化</h2>
          <h3 className="lsn-sub">做得快的挑戰題</h3>
          <Text v={l.challenge} />
          <h3 className="lsn-sub">需要協助時的簡化版</h3>
          <Text v={l.support} />
        </section>
        <section className="adm-panel">
          <h2>器材與材料</h2>
          {materials.length ? (
            <ul className="lsn-mats">
              {materials.map((m, i) => <li key={i}>{m.name}{m.qty && <small>{m.qty}</small>}</li>)}
            </ul>
          ) : <p className="adm-empty">—</p>}
        </section>
      </div>

      <section className="adm-panel">
        <h2>對外文字</h2>
        <h3 className="lsn-sub">給家長的話</h3>
        <Text v={l.parent_note} />
        <h3 className="lsn-sub">活動簡介</h3>
        <Text v={l.outline} />
      </section>

      <section className="adm-panel">
        <h2>常見卡關與解法</h2>
        <Text v={l.tips} />
      </section>

      <section className="adm-panel lsn-noprint">
        <h2>排課紀錄 <small>上過 {past.length} 堂・之後 {upcoming.length} 堂</small></h2>
        {sessions.length === 0 ? (
          <p className="adm-empty">還沒有班級排這個教案。到「開班與排課」的班級頁，在每一堂旁邊可以選教案。</p>
        ) : (
          <ul className="adm-rows">
            {[...upcoming, ...past].map((s) => (
              <li key={s.id} className={new Date(s.starts_at).getTime() < now ? "muted" : ""}>
                <Link href={`/admin/sessions/${s.id}`}>{fmtDate(s.starts_at)} {fmtTime(s.starts_at)}</Link>
                <Link href={`/admin/classes/${s.classes.id}`}><small>{s.classes.name}</small></Link>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">課後回饋與版本紀錄會在之後加上。</p>
      </section>

      {editable && (
        <section className="adm-panel lsn-noprint">
          <h2>狀態</h2>
          <div className="adm-btns">
            {(["draft", "ready", "archived"] as const).filter((s) => s !== l.status).map((s) => (
              <form key={s} action={setLessonStatus}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="status" value={s} />
                <button type="submit" className="btn btn-sm">
                  {s === "draft" ? "改回草稿" : s === "ready" ? "設為可使用" : "封存"}
                </button>
              </form>
            ))}
          </div>
          <p className="hint">封存後不會出現在教案庫列表、也不能再排課，但上過的紀錄都會保留；隨時可以恢復。</p>
        </section>
      )}
    </>
  );
}

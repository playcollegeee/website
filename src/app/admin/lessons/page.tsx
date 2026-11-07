import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet, sbRpc, sbSignUrls } from "@/lib/supabase";
import { LEVEL_NAME, fmtDate } from "@/lib/admin";
import {
  DIFFICULTY, LESSON_BUCKET, LESSON_STATUS, MAJOR_SHORT, TAG_KIND_LABEL, categoryLabel, levelsLabel, stars,
  type Category, type Tag,
} from "@/lib/lessons";

export const metadata = { title: "教案庫" };

type Row = {
  id: string; title: string; summary: string | null; minutes: number; difficulty: number | null; status: string;
  levels: string[]; updated_at: string;
  category: { major: string; name: string } | null;
  author: { name: string; nickname: string | null } | null;
  lesson_tags: { tags: Tag }[];
};

type SP = {
  q?: string; major?: string; category?: string; level?: string; tag?: string | string[];
  difficulty?: string; author?: string; status?: string;
};

const MAJORS = ["lego", "3d", "art"];

export default async function LessonsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? "").replace(/[%_\\]/g, " ").trim().slice(0, 60);
  const major = MAJORS.includes(sp.major ?? "") ? sp.major! : "";
  const category = isUuid(sp.category) ? sp.category : "";
  const level = LEVEL_NAME[sp.level ?? ""] ? sp.level! : "";
  const tagIds = [...new Set((Array.isArray(sp.tag) ? sp.tag : sp.tag ? [sp.tag] : []).filter(isUuid))].slice(0, 10);
  const difficulty = DIFFICULTY.includes(Number(sp.difficulty)) ? Number(sp.difficulty) : null;
  const author = sp.author === "me" ? staff.id : isUuid(sp.author) ? sp.author : "";
  const status = ["ready", "draft", "archived", "all"].includes(sp.status ?? "") ? sp.status! : "";

  const [categories, teachers, allTags, found] = await Promise.all([
    sbGet<Category[]>("lesson_categories?select=id,major,name,levels,sort,active&order=major,sort,name"),
    sbGet<{ id: string; name: string; nickname: string | null }[]>("teachers?active=eq.true&order=name&select=id,name,nickname"),
    sbGet<Tag[]>("tags?select=id,kind,name&order=name"),
    sbRpc<{ id: string }[]>("search_lessons", {
      p_q: q || null,
      p_major: major || null,
      p_category: category || null,
      p_level: level || null,
      p_tags: tagIds.length ? tagIds : null,
      p_difficulty: difficulty,
      p_author: author || null,
      p_status: status || null,
    }),
  ]);

  const ids = found.map((f) => f.id);
  const details = ids.length
    ? await sbGet<Row[]>(
        `lessons?id=in.(${ids.join(",")})&select=id,title,summary,minutes,difficulty,status,levels,updated_at,` +
          `category:lesson_categories(major,name),author:teachers!lessons_author_id_fkey(name,nickname),lesson_tags(tags(id,kind,name))`,
      )
    : [];
  const byId = new Map(details.map((d) => [d.id, d]));

  // 封面縮圖與 .io 數量（照片在私人空間，產生 1 小時有效的連結）
  const fileRows = ids.length
    ? await sbGet<{ lesson_id: string; kind: string; thumb_path: string | null; storage_path: string; is_cover: boolean; sort: number }[]>(
        `lesson_files?lesson_id=in.(${ids.join(",")})&kind=in.(image,model_io)&select=lesson_id,kind,thumb_path,storage_path,is_cover,sort&order=sort`,
      )
    : [];
  const coverPath = new Map<string, string>();
  const ioCount = new Map<string, number>();
  for (const f of fileRows) {
    if (f.kind === "model_io") ioCount.set(f.lesson_id, (ioCount.get(f.lesson_id) ?? 0) + 1);
    else if (f.is_cover || !coverPath.has(f.lesson_id)) coverPath.set(f.lesson_id, f.thumb_path ?? f.storage_path);
  }
  const coverUrl = await sbSignUrls(LESSON_BUCKET, [...new Set(coverPath.values())]);
  const rows = ids.map((id) => byId.get(id)).filter((r): r is Row => !!r);

  const selectedTags = tagIds.map((id) => allTags.find((t) => t.id === id)).filter((t): t is Tag => !!t);
  const filtering = !!(q || major || category || level || tagIds.length || difficulty || author || status);

  // 產生「加上／拿掉某個標籤」的網址，其他篩選條件不變
  const urlWith = (tags: string[]) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (major) p.set("major", major);
    if (category) p.set("category", category);
    if (level) p.set("level", level);
    if (difficulty) p.set("difficulty", String(difficulty));
    if (sp.author === "me" || author) p.set("author", sp.author === "me" ? "me" : author);
    if (status) p.set("status", status);
    for (const t of tags) p.append("tag", t);
    return `/admin/lessons?${p}`;
  };

  return (
    <>
      <div className="adm-head">
        <h1>教案庫 <small>{rows.length} 個{rows.length >= 200 ? "以上" : ""}</small></h1>
        <div className="adm-actions">
          <Link href="/admin/lessons?author=me&status=all" className="btn btn-sm">我的教案</Link>
          {staff.is_admin && <Link href="/admin/lessons/import-files" className="btn btn-sm">📁 匯入照片與 .io</Link>}
          <Link href={`/admin/lessons/new${category ? `?category=${category}` : ""}`} className="btn btn-sm primary">＋ 新增教案</Link>
        </div>
      </div>

      <form className="adm-filters lsn-filters" role="search">
        <input name="q" defaultValue={q} placeholder="關鍵字（標題、內容、標籤；空白分開多個詞）" aria-label="關鍵字" className="lsn-q" />
        <select name="major" defaultValue={major} aria-label="主修">
          <option value="">全部主修</option>
          {MAJORS.map((m) => <option key={m} value={m}>{MAJOR_SHORT[m]}</option>)}
        </select>
        <select name="category" defaultValue={category} aria-label="課程類別">
          <option value="">全部類別</option>
          {MAJORS.map((m) => (
            <optgroup key={m} label={MAJOR_SHORT[m]}>
              {categories.filter((c) => c.major === m).map((c) => (
                <option key={c.id} value={c.id}>{c.name}{!c.active && "（停用）"}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select name="level" defaultValue={level} aria-label="階段">
          <option value="">全部階段</option>
          {Object.entries(LEVEL_NAME).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
        <select name="difficulty" defaultValue={difficulty ?? ""} aria-label="難易度">
          <option value="">全部難度</option>
          {DIFFICULTY.map((d) => <option key={d} value={d}>{"★".repeat(d)}</option>)}
        </select>
        <select name="author" defaultValue={sp.author === "me" ? "me" : author} aria-label="作者">
          <option value="">全部老師</option>
          <option value="me">我寫的</option>
          {teachers.filter((t) => t.id !== staff.id).map((t) => <option key={t.id} value={t.id}>{t.nickname ?? t.name}</option>)}
        </select>
        <select name="status" defaultValue={status} aria-label="狀態">
          <option value="">草稿＋可使用</option>
          <option value="ready">只看可使用</option>
          <option value="draft">只看草稿</option>
          <option value="archived">已封存</option>
          <option value="all">全部</option>
        </select>
        {tagIds.map((t) => <input key={t} type="hidden" name="tag" value={t} />)}
        <button className="btn btn-sm" type="submit">搜尋</button>
        {filtering && <Link href="/admin/lessons" className="adm-link">清除條件</Link>}
      </form>

      {selectedTags.length > 0 && (
        <p className="lsn-selected">
          標籤：
          {selectedTags.map((t) => (
            <Link key={t.id} href={urlWith(tagIds.filter((x) => x !== t.id))} className={`lsn-chip lsn-chip-${t.kind}`} title="拿掉這個條件">
              {TAG_KIND_LABEL[t.kind]}・{t.name} ✕
            </Link>
          ))}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="adm-panel">
          <p className="adm-empty">
            {filtering ? "找不到符合條件的教案，試試少一點條件或換個關鍵字。" : "教案庫還是空的，按右上角「新增教案」寫第一個吧！"}
          </p>
        </div>
      ) : (
        <ul className="lsn-cards">
          {rows.map((r) => {
            const st = LESSON_STATUS[r.status] ?? LESSON_STATUS.draft;
            const tags = r.lesson_tags.map((x) => x.tags);
            return (
              <li key={r.id} className={`lsn-card lsn-major-${r.category?.major ?? "none"}`}>
                {(() => {
                  const url = coverUrl.get(coverPath.get(r.id) ?? "");
                  return (
                    <Link href={`/admin/lessons/${r.id}`} className={`lsn-card-img${url ? "" : " is-empty"}`} tabIndex={-1} aria-hidden>
                      {url ? <img src={url} alt="" loading="lazy" /> : <span>尚無照片</span>}
                    </Link>
                  );
                })()}
                <div className="lsn-card-top">
                  <span className="lsn-cat">{categoryLabel(r.category)}</span>
                  {r.status !== "ready" && <span className={`tag ${st.tag}`}>{st.label}</span>}
                </div>
                <Link href={`/admin/lessons/${r.id}`} className="lsn-card-title">{r.title}</Link>
                {r.summary && <p className="lsn-card-sum">{r.summary}</p>}
                <p className="lsn-card-meta">
                  {levelsLabel(r.levels)}・{r.minutes} 分・<span className="lsn-stars">{stars(r.difficulty)}</span>
                </p>
                {tags.length > 0 && (
                  <div className="lsn-card-tags">
                    {tags.slice(0, 8).map((t) => (
                      <Link
                        key={t.id}
                        href={tagIds.includes(t.id) ? urlWith(tagIds) : urlWith([...tagIds, t.id])}
                        className={`lsn-chip lsn-chip-${t.kind}`}
                        title={`${TAG_KIND_LABEL[t.kind]}：只看有這個標籤的教案`}
                      >
                        {t.name}
                      </Link>
                    ))}
                    {tags.length > 8 && <small>＋{tags.length - 8}</small>}
                  </div>
                )}
                <p className="lsn-card-foot">
                  {ioCount.get(r.id) ? <span className="lsn-io-badge" title="有組裝圖檔">🧱 .io</span> : null}
                  {r.author ? r.author.nickname ?? r.author.name : "—"}・{fmtDate(r.updated_at)} 更新
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

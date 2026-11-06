import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import { LEVEL_NAME } from "@/lib/admin";
import { MAJOR_SHORT, TAG_KINDS, levelsLabel, type Category, type Tag } from "@/lib/lessons";
import { createCategory, createTag, deleteTag, mergeTag, renameTag, updateCategory } from "./actions";

export const metadata = { title: "課程分類與標籤" };

const MAJORS = ["lego", "3d", "art"];

function LevelChecks({ chosen }: { chosen: string[] }) {
  return (
    <fieldset className="adm-levels adm-wide">
      <legend>建議階段</legend>
      {Object.entries(LEVEL_NAME).map(([v, n]) => (
        <label key={v} className="adm-check"><input type="checkbox" name="levels" value={v} defaultChecked={chosen.includes(v)} /> {n}</label>
      ))}
    </fieldset>
  );
}

export default async function LessonSettingsPage() {
  await requireStaff(true);
  const [cats, tags, links, lessons] = await Promise.all([
    sbGet<(Category & { description: string | null })[]>("lesson_categories?select=id,major,name,levels,sort,active,description&order=major,sort,name"),
    sbGet<Tag[]>("tags?select=id,kind,name&order=name"),
    sbGet<{ tag_id: string }[]>("lesson_tags?select=tag_id"),
    sbGet<{ category_id: string | null }[]>("lessons?select=category_id"),
  ]);
  const tagUse = new Map<string, number>();
  for (const l of links) tagUse.set(l.tag_id, (tagUse.get(l.tag_id) ?? 0) + 1);
  const catUse = new Map<string, number>();
  for (const l of lessons) if (l.category_id) catUse.set(l.category_id, (catUse.get(l.category_id) ?? 0) + 1);

  return (
    <>
      <div className="adm-head">
        <h1>課程分類與標籤</h1>
        <Link href="/admin/lessons" className="adm-link">← 教案庫</Link>
      </div>

      <section className="adm-panel">
        <h2>課程類別</h2>
        <p className="hint">類別可以改名、調整排序與建議階段；不再使用的類別請「停用」（舊教案保留，但新教案不能選）。排序數字小的排前面。</p>
        {MAJORS.map((m) => (
          <div key={m} className="lsn-set-group">
            <h3>{MAJOR_SHORT[m]}</h3>
            <ul className="adm-list">
              {cats.filter((c) => c.major === m).map((c) => (
                <li key={c.id} className={`adm-guardian ${c.active ? "" : "muted"}`}>
                  <details>
                    <summary>
                      <strong>{c.name}</strong>
                      <small>{levelsLabel(c.levels)}・{catUse.get(c.id) ?? 0} 個教案</small>
                      {!c.active && <span className="tag tag-gray">已停用</span>}
                      <span className="adm-inline">編輯</span>
                    </summary>
                    <form action={updateCategory} className="adm-grid">
                      <input type="hidden" name="id" value={c.id} />
                      <div className="field"><label htmlFor={`cn-${c.id}`}>名稱</label><input id={`cn-${c.id}`} name="name" defaultValue={c.name} required maxLength={30} /></div>
                      <div className="field"><label htmlFor={`cs-${c.id}`}>排序</label><input id={`cs-${c.id}`} name="sort" type="number" min={0} max={999} defaultValue={c.sort} /></div>
                      <LevelChecks chosen={c.levels} />
                      <div className="field adm-wide"><label htmlFor={`cd-${c.id}`}>說明（選填）</label><input id={`cd-${c.id}`} name="description" defaultValue={c.description ?? ""} maxLength={300} /></div>
                      <label className="adm-check adm-wide"><input type="checkbox" name="active" defaultChecked={c.active} /> 使用中</label>
                      <div className="adm-wide"><button className="btn btn-sm" type="submit">儲存</button></div>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
            <details className="adm-add">
              <summary>＋ 新增{MAJOR_SHORT[m]}類別</summary>
              <form action={createCategory} className="adm-grid">
                <input type="hidden" name="major" value={m} />
                <div className="field"><label htmlFor={`nn-${m}`}>名稱</label><input id={`nn-${m}`} name="name" required maxLength={30} /></div>
                <div className="field"><label htmlFor={`ns-${m}`}>排序</label><input id={`ns-${m}`} name="sort" type="number" min={0} max={999} defaultValue={100} /></div>
                <LevelChecks chosen={[]} />
                <div className="adm-wide"><button className="btn btn-sm" type="submit">新增</button></div>
              </form>
            </details>
          </div>
        ))}
      </section>

      <section className="adm-panel">
        <h2>標籤詞庫 <small>{tags.length} 個</small></h2>
        <p className="hint">老師寫教案時會自動新增標籤。發現同義詞（例：「齒輪」和「齒輪傳動」）時用「合併」，所有教案會改掛到保留的那個。沒有教案在用的標籤才能刪除。</p>
        {TAG_KINDS.map((k) => {
          const ts = tags.filter((t) => t.kind === k.value);
          return (
            <div key={k.value} className="lsn-set-group">
              <h3>{k.label} <small>{ts.length} 個</small></h3>
              <div className="lsn-set-tags">
                {ts.map((t) => {
                  const n = tagUse.get(t.id) ?? 0;
                  return (
                    <details key={t.id} className="lsn-set-tag">
                      <summary><span className={`lsn-chip lsn-chip-${k.value}`}>{t.name} <b>{n}</b></span></summary>
                      <div className="lsn-set-pop">
                        <form action={renameTag} className="adm-inline-form">
                          <input type="hidden" name="id" value={t.id} />
                          <input name="name" defaultValue={t.name} maxLength={30} required aria-label="新名稱" />
                          <button className="btn btn-sm" type="submit">改名</button>
                        </form>
                        {ts.length > 1 && (
                          <form action={mergeTag} className="adm-inline-form">
                            <input type="hidden" name="id" value={t.id} />
                            <select name="into" required defaultValue="" aria-label="合併到">
                              <option value="" disabled>合併到…</option>
                              {ts.filter((x) => x.id !== t.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                            <button className="btn btn-sm" type="submit">合併</button>
                          </form>
                        )}
                        {n === 0 ? (
                          <form action={deleteTag}>
                            <input type="hidden" name="id" value={t.id} />
                            <button className="adm-link danger" type="submit">刪除這個標籤</button>
                          </form>
                        ) : (
                          <Link href={`/admin/lessons?tag=${t.id}&status=all`} className="adm-link">看 {n} 個教案</Link>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
              <form action={createTag} className="adm-inline-form">
                <input type="hidden" name="kind" value={k.value} />
                <input name="name" maxLength={30} required placeholder={`新增${k.label}標籤`} aria-label={`新增${k.label}標籤`} />
                <button className="btn btn-sm" type="submit">新增</button>
              </form>
            </div>
          );
        })}
      </section>
    </>
  );
}

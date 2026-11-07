import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import { LEVEL_NAME } from "@/lib/admin";
import { MAJOR_SHORT, PRESET_KIND_LABEL, TAG_KINDS, levelsLabel, type Category, type MaterialPreset, type Tag } from "@/lib/lessons";
import {
  createCategory, createPreset, createTag, deletePreset, deleteTag, mergeTag, renameTag, updateCategory, updatePreset,
} from "./actions";

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
  const [cats, tags, links, lessons, presets] = await Promise.all([
    sbGet<(Category & { description: string | null })[]>("lesson_categories?select=id,major,name,levels,sort,active,description&order=major,sort,name"),
    sbGet<Tag[]>("tags?select=id,kind,name&order=name"),
    sbGet<{ tag_id: string }[]>("lesson_tags?select=tag_id"),
    sbGet<{ category_id: string | null }[]>("lessons?select=category_id"),
    sbGet<MaterialPreset[]>("material_presets?select=id,name,kind,sort,active&order=sort,name").catch(() => [] as MaterialPreset[]),
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
        <h2>器材盒組與常用材料 <small>{presets.length} 個</small></h2>
        <p className="hint">老師在教案的「器材與材料」可以直接點選這些項目，也可以自己打字。排序數字小的在前面；取消「使用中」或刪除後就不會出現在點選清單（已寫進教案的不受影響）。</p>
        <table className="adm-table lsn-preset-table">
          <thead><tr><th>名稱</th><th>種類</th><th>排序</th><th>使用中</th><th></th></tr></thead>
          <tbody>
            {presets.map((p) => (
              <tr key={p.id}>
                <td colSpan={5}>
                  <form action={updatePreset} className="adm-inline-form">
                    <input type="hidden" name="id" value={p.id} />
                    <input name="name" defaultValue={p.name} maxLength={80} required aria-label="名稱" />
                    <select name="kind" defaultValue={p.kind} aria-label="種類">
                      {Object.entries(PRESET_KIND_LABEL).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                    </select>
                    <input name="sort" type="number" min={0} max={999} defaultValue={p.sort} aria-label="排序" className="lsn-sort" />
                    <label className="adm-check"><input type="checkbox" name="active" defaultChecked={p.active} /> 使用中</label>
                    <button className="btn btn-sm" type="submit">儲存</button>
                    <button className="adm-link danger" type="submit" formAction={deletePreset}>刪除</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={createPreset} className="adm-inline-form">
          <input name="name" maxLength={80} required placeholder="新增盒組或材料，例：SPIKE Essential(45345)" aria-label="新增項目名稱" />
          <select name="kind" defaultValue="kit" aria-label="種類">
            {Object.entries(PRESET_KIND_LABEL).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
          <input name="sort" type="number" min={0} max={999} defaultValue={(presets.at(-1)?.sort ?? 0) + 10} aria-label="排序" className="lsn-sort" />
          <button className="btn btn-sm" type="submit">新增</button>
        </form>
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

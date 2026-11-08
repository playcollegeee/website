import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { AREAS, STAGES } from "@/lib/eventTypes";
import { loadContacts } from "./data";
import ContactTable from "./ContactTable";
import TagManager from "./TagManager";

export const metadata = { title: "活動名單" };
type SP = { q?: string; tag?: string; series?: string; theme?: string; stage?: string; area?: string; kind?: string; mk?: string; ret?: string };

// 後台：活動名單（報名過活動的孩子與成人），用標籤篩選後推播後續課程
export default async function ContactsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireStaff(true);
  const sp = await searchParams;
  let data;
  try {
    data = await loadContacts();
  } catch (e) {
    return (
      <>
        <h1>活動名單</h1>
        <div className="notice err">{e instanceof Error ? e.message : "讀取失敗"}。如果是第一次使用，請先在 Supabase 執行 <code>supabase/migrations/0016_activity_signup.sql</code>。</div>
      </>
    );
  }
  const { rows, tags } = data;
  const allSeries = [...new Set(rows.flatMap((r) => r.series))].sort();
  const allThemes = [...new Set(rows.flatMap((r) => r.themes))].sort();
  const q = sp.q?.trim().toLowerCase() ?? "";
  const filtered = rows.filter(
    (r) =>
      (!q || r.name.toLowerCase().includes(q) || r.family.name.toLowerCase().includes(q) || r.family.phone.includes(q.replace(/\D/g, "") || "§") || (r.family.social_name ?? "").toLowerCase().includes(q)) &&
      (!sp.tag || r.manual.some((t) => t.id === sp.tag)) &&
      (!sp.series || r.series.includes(sp.series)) &&
      (!sp.theme || r.themes.includes(sp.theme)) &&
      (!sp.stage || r.stage === sp.stage) &&
      (!sp.area || r.areas.includes(sp.area)) &&
      (!sp.kind || r.kind === sp.kind) &&
      (sp.mk !== "1" || r.family.marketing) &&
      (sp.ret !== "1" || r.returning),
  );
  const families = new Set(rows.map((r) => r.family_id)).size;
  const mkFamilies = new Set(rows.filter((r) => r.family.marketing).map((r) => r.family_id)).size;

  return (
    <>
      <div className="adm-head">
        <h1>活動名單</h1>
        <div className="adm-actions"><Link className="btn btn-sm" href="/admin/events">活動報名</Link></div>
      </div>
      <p className="hint">
        報名過活動的人都會自動進來：大人自己報名記成「成人」，陪孩子參加的記孩子、家長當聯絡人。年級每年 8 月自動升一級。
        共 {rows.length} 人、{families} 個家庭，其中 {mkFamilies} 個家庭同意收到後續資訊。
      </p>
      <p className="adm-warn">推播後續課程時，只傳給「同意收訊息」的家庭（篩選勾選「只看同意收訊息」）。</p>

      <form className="adm-panel adm-filters" method="get">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="搜尋姓名、電話、私訊名" />
        <select name="stage" defaultValue={sp.stage ?? ""}>
          <option value="">所有階段</option>
          {STAGES.map((s) => <option key={s.slug}>{s.name}</option>)}
          <option>成人</option>
        </select>
        <select name="series" defaultValue={sp.series ?? ""}>
          <option value="">所有系列</option>
          {allSeries.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select name="theme" defaultValue={sp.theme ?? ""}>
          <option value="">所有主題</option>
          {allThemes.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select name="area" defaultValue={sp.area ?? ""}>
          <option value="">所有地區</option>
          {AREAS.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select name="tag" defaultValue={sp.tag ?? ""}>
          <option value="">所有標籤</option>
          {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select name="kind" defaultValue={sp.kind ?? ""}>
          <option value="">孩子與成人</option>
          <option value="child">只看孩子</option>
          <option value="adult">只看成人</option>
        </select>
        <label className="adm-check"><input type="checkbox" name="mk" value="1" defaultChecked={sp.mk === "1"} />只看同意收訊息</label>
        <label className="adm-check"><input type="checkbox" name="ret" value="1" defaultChecked={sp.ret === "1"} />只看舊生</label>
        <button type="submit" className="btn btn-sm primary">篩選</button>
        <Link href="/admin/contacts" className="adm-link">清除</Link>
      </form>

      <ContactTable
        tags={tags}
        rows={filtered.map((r) => ({
          id: r.id,
          familyId: r.family_id,
          name: r.name,
          kind: r.kind,
          gradeText: r.gradeText,
          stage: r.stage,
          contact: r.family.name,
          phone: r.family.phone,
          social: r.family.social_name,
          marketing: r.family.marketing,
          auto: [...r.series, ...r.themes, ...r.areas, ...(r.returning ? ["舊生"] : [])],
          manual: r.manual,
        }))}
      />
      <TagManager tags={tags} />
    </>
  );
}

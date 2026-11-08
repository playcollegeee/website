// 活動名單：讀取並算出自動標籤（參加過的系列、主題、地區、階段、舊生）
import { sbGet } from "@/lib/supabase";
import { currentGrade, gradeLabel, SHOWCASE_LABEL, stageOf, type ContactTag, type Family, type Person } from "@/lib/eventTypes";

export type PersonRow = Person & {
  family: Family;
  gradeNow: number | null;
  gradeText: string;
  stage: string | null;
  series: string[];
  themes: string[];
  areas: string[];
  returning: boolean;
  manual: ContactTag[];
  lastActivity: string | null;
};

type BRow = { id: string; family_id: string | null; run_id: string; slot_id: string; status: string; created_at: string };

export async function loadContacts(familyId?: string): Promise<{ rows: PersonRow[]; tags: ContactTag[] }> {
  const fam = familyId ? `&id=eq.${familyId}` : "";
  const [families, people, tags, personTags] = await Promise.all([
    sbGet<Family[]>(`contact_families?select=*${fam}&order=last_seen.desc&limit=3000`),
    sbGet<Person[]>(`contact_people?select=*${familyId ? `&family_id=eq.${familyId}` : ""}&limit=6000`),
    sbGet<ContactTag[]>("contact_tags?select=*&order=name"),
    sbGet<{ person_id: string; tag_id: string }[]>("contact_person_tags?select=person_id,tag_id&limit=20000"),
  ]);
  const fm = new Map(families.map((f) => [f.id, f]));
  const bookings = await sbGet<BRow[]>(
    `activity_bookings?status=eq.paid&select=id,family_id,run_id,slot_id,status,created_at${familyId ? `&family_id=eq.${familyId}` : ""}&limit=10000`,
  );
  const bIds = bookings.map((b) => b.id);
  // 報名不多時只抓這些報名的參加者；很多時直接全抓（避免網址太長）
  const bp = bIds.length
    ? await sbGet<{ booking_id: string; person_id: string | null }[]>(
        `activity_booking_people?select=booking_id,person_id&person_id=not.is.null${bIds.length <= 200 ? `&booking_id=in.(${bIds.join(",")})` : ""}&limit=20000`,
      )
    : [];
  const runIds = [...new Set(bookings.map((b) => b.run_id))];
  const runs = runIds.length ? await sbGet<{ id: string; theme_id: string }[]>(`activity_runs?id=in.(${runIds.join(",")})&select=id,theme_id`) : [];
  const themes = await sbGet<{ id: string; title: string; showcase: string; activity_id: string | null }[]>("activity_themes?select=id,title,showcase,activity_id");
  const acts = await sbGet<{ id: string; title: string }[]>("activities?select=id,title").catch(() => []);
  const slotIds = [...new Set(bookings.map((b) => b.slot_id))];
  const slots = slotIds.length ? await sbGet<{ id: string; area: string | null }[]>(`activity_slots?id=in.(${slotIds.join(",")})&select=id,area`) : [];

  const runTheme = new Map(runs.map((r) => [r.id, themes.find((t) => t.id === r.theme_id)]));
  const actTitle = new Map(acts.map((a) => [a.id, a.title]));
  const slotArea = new Map(slots.map((s) => [s.id, s.area]));
  const bmap = new Map(bookings.map((b) => [b.id, b]));
  const tagMap = new Map(tags.map((t) => [t.id, t]));
  // 每個家庭參加過幾次不同的開課（2 次以上算舊生）
  const famRuns = new Map<string, Set<string>>();
  for (const b of bookings) if (b.family_id) famRuns.set(b.family_id, (famRuns.get(b.family_id) ?? new Set()).add(b.run_id));

  const rows: PersonRow[] = [];
  for (const p of people) {
    const family = fm.get(p.family_id);
    if (!family) continue;
    const mine = bp.filter((x) => x.person_id === p.id).map((x) => bmap.get(x.booking_id)).filter((b): b is BRow => !!b);
    const series = new Set<string>();
    const ths = new Set<string>();
    const areas = new Set<string>();
    let last: string | null = null;
    for (const b of mine) {
      const t = runTheme.get(b.run_id);
      if (t) {
        ths.add(t.title);
        const s = (t.activity_id && actTitle.get(t.activity_id)) || (t.showcase !== "none" ? SHOWCASE_LABEL[t.showcase as "3d" | "kids"] : null);
        if (s) series.add(s);
      }
      const a = slotArea.get(b.slot_id);
      if (a) areas.add(a);
      if (!last || b.created_at > last) last = b.created_at;
    }
    const gradeNow = p.kind === "adult" ? null : currentGrade(p);
    rows.push({
      ...p,
      family,
      gradeNow,
      gradeText: p.kind === "adult" ? "成人" : gradeLabel(gradeNow),
      stage: p.kind === "adult" ? "成人" : stageOf(gradeNow),
      series: [...series],
      themes: [...ths],
      areas: [...areas],
      returning: (famRuns.get(p.family_id)?.size ?? 0) >= 2,
      manual: personTags.filter((x) => x.person_id === p.id).map((x) => tagMap.get(x.tag_id)).filter((t): t is ContactTag => !!t),
      lastActivity: last,
    });
  }
  rows.sort((a, b) => (b.lastActivity ?? b.family.last_seen).localeCompare(a.lastActivity ?? a.family.last_seen));
  return { rows, tags };
}

import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import { SHOWCASE_LABEL, type Theme, type ThemePhoto } from "@/lib/events";
import type { Activity } from "@/lib/activityTypes";
import ThemeEditor from "./ThemeEditor";

export const metadata = { title: "活動主題" };

// 後台：主題（工作坊總覽的每一張卡片＋每次開課的共用介紹）
export default async function ThemesPage() {
  await requireStaff(true);
  const [themes, photos, activities] = await Promise.all([
    sbGet<Theme[]>("activity_themes?select=*&order=showcase,sort,created_at"),
    sbGet<ThemePhoto[]>("activity_theme_photos?select=*&order=sort,created_at"),
    sbGet<Activity[]>("activities?select=id,title&order=sort").catch(() => [] as Activity[]),
  ]);
  const acts = activities.map((a) => ({ id: a.id, title: a.title }));
  return (
    <>
      <p className="hint"><Link href="/admin/events">← 活動報名</Link></p>
      <div className="adm-head">
        <h1>活動主題</h1>
        <div className="adm-actions"><Link className="btn btn-sm" href="/workshops/all" target="_blank">看官網工作坊總覽 ↗</Link></div>
      </div>
      <p className="hint">
        每個主題（例如飆速遙控計畫、萬聖節積木派對）有自己的介紹與照片，可以重複開課。分類選「3D 造物工作坊」或「幼兒主題活動」就會出現在官網工作坊總覽；選「不列出」只用來開課（例如每月的積木故事屋）。
      </p>
      <h2 className="ph-h">新增主題</h2>
      <ThemeEditor key="new" activities={acts} photos={[]} />
      {(["3d", "kids", "none"] as const).map((k) => {
        const list = themes.filter((t) => t.showcase === k);
        if (list.length === 0) return null;
        return (
          <section key={k}>
            <h2 className="ph-h">{SHOWCASE_LABEL[k]}（{list.length}）</h2>
            {list.map((t) => (
              <ThemeEditor key={`${t.id}-${t.cover_url}`} theme={t} activities={acts} photos={photos.filter((p) => p.theme_id === t.id)} />
            ))}
          </section>
        );
      })}
    </>
  );
}

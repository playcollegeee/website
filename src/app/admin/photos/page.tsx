import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import type { PhotoSection, SitePhoto } from "@/lib/sitePhotos";
import { deletePhoto, movePhoto, savePhoto } from "./actions";
import PhotoEditor from "./PhotoEditor";

export const metadata = { title: "官網照片" };

const TABS: { value: PhotoSection; label: string; hint: string }[] = [
  { value: "highlights", label: "成果與活動紀錄", hint: "首頁「孩子們最近做了什麼」的卡片：照片＋時間＋標題＋介紹。建議放 3 張。" },
  { value: "gallery", label: "教室現場", hint: "首頁黃色作品牆：照片＋一句說明。直的、橫的照片都可以，建議 6 張左右。" },
];

export default async function PhotosPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requireStaff(true);
  const { s } = await searchParams;
  const tab = TABS.find((t) => t.value === s) ?? TABS[0];

  let photos: SitePhoto[] = [];
  let error = "";
  try {
    photos = await sbGet<SitePhoto[]>(`site_photos?section=eq.${tab.value}&order=sort,created_at&select=*`);
  } catch (e) {
    error = e instanceof Error ? e.message : "讀取失敗";
  }

  return (
    <>
      <div className="adm-head">
        <h1>官網照片</h1>
        <div className="adm-actions">
          <Link className="btn btn-sm" href="/" target="_blank">看官網首頁 ↗</Link>
        </div>
      </div>

      <nav className="admin-filter" aria-label="照片區塊">
        {TABS.map((t) => (
          <Link key={t.value} href={`/admin/photos?s=${t.value}`} className={t.value === tab.value ? "on" : ""}>
            {t.label}
          </Link>
        ))}
      </nav>
      <p className="hint">{tab.hint} 存檔後官網馬上更新；取消勾選「顯示在官網」可以先藏起來。</p>
      <p className="adm-warn">⚠ 有孩子入鏡的照片，請先確認家長的照片公開設定；不要在說明裡寫孩子全名。</p>

      {error ? (
        <div className="notice err">
          {error}。如果是第一次使用，請先在 Supabase 執行 <code>supabase/migrations/0004_site_photos.sql</code>。
        </div>
      ) : (
        <>
          <h2 className="ph-h">新增一張</h2>
          <PhotoEditor key={`new-${tab.value}`} section={tab.value} save={savePhoto} />

          <h2 className="ph-h">目前的照片（{photos.length}）</h2>
          {photos.length === 0 && <p className="adm-empty">這個區塊還沒有照片，官網上會先隱藏。</p>}
          <div className="ph-list">
            {photos.map((p, i) => (
              <PhotoEditor
                key={`${p.id}-${p.image_url}-${p.sort}`}
                section={tab.value}
                photo={p}
                save={savePhoto}
                move={movePhoto}
                remove={deletePhoto}
                isFirst={i === 0}
                isLast={i === photos.length - 1}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

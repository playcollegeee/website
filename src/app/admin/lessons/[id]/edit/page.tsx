import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet } from "@/lib/supabase";
import { canEditLesson, materialsOf, type Category, type Tag } from "@/lib/lessons";
import { aiConfigured } from "@/lib/ai";
import LessonForm from "../../LessonForm";

export const metadata = { title: "編輯教案" };
export const maxDuration = 60; // AI 產生初稿最多等 60 秒

type L = {
  id: string; title: string; category_id: string | null; levels: string[]; difficulty: number | null; minutes: number;
  summary: string | null; challenge: string | null;
  support: string | null; materials: unknown; tips: string | null; xp: number; status: string; author_id: string | null;
  lesson_tags: { tags: Tag }[];
};

export default async function EditLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [rows, categories, tags, photos] = await Promise.all([
    sbGet<L[]>(
      `lessons?id=eq.${id}&select=id,title,category_id,levels,difficulty,minutes,summary,challenge,support,materials,tips,xp,status,author_id,lesson_tags(tags(id,kind,name))`,
    ),
    sbGet<Category[]>("lesson_categories?select=id,major,name,levels,sort,active&order=major,sort,name"),
    sbGet<Tag[]>("tags?select=id,kind,name&order=name"),
    sbGet<{ id: string }[]>(`lesson_files?lesson_id=eq.${id}&kind=eq.image&select=id&limit=1`),
  ]);
  const l = rows[0];
  if (!l) notFound();
  if (!canEditLesson(staff, l.author_id)) {
    return (
      <>
        <div className="adm-head"><h1>編輯教案</h1></div>
        <p className="notice err">只有作者或管理員可以修改這個教案。</p>
        <p><Link href={`/admin/lessons/${id}`} className="adm-link">← 回教案</Link></p>
      </>
    );
  }

  return (
    <>
      <div className="adm-head">
        <h1>編輯教案 <small>{l.title}</small></h1>
        <Link href={`/admin/lessons/${id}`} className="adm-link">← 回教案（不儲存）</Link>
      </div>
      <LessonForm
        categories={categories}
        tags={tags}
        aiReady={aiConfigured()}
        hasPhoto={photos.length > 0}
        init={{
          id: l.id, title: l.title, category_id: l.category_id ?? "", levels: l.levels, difficulty: l.difficulty,
          minutes: l.minutes, summary: l.summary ?? "", challenge: l.challenge ?? "", support: l.support ?? "",
          materials: materialsOf(l.materials), tips: l.tips ?? "", xp: l.xp,
          status: l.status, tags: l.lesson_tags.map((x) => x.tags),
        }}
      />
    </>
  );
}

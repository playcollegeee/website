import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet } from "@/lib/supabase";
import type { Category, Tag } from "@/lib/lessons";
import LessonForm from "../LessonForm";

export const metadata = { title: "新增教案" };

export default async function NewLessonPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  await requireStaff();
  const { category = "" } = await searchParams;
  const [categories, tags] = await Promise.all([
    sbGet<Category[]>("lesson_categories?select=id,major,name,levels,sort,active&order=major,sort,name"),
    sbGet<Tag[]>("tags?select=id,kind,name&order=name"),
  ]);
  const cat = isUuid(category) ? categories.find((c) => c.id === category && c.active) : undefined;

  return (
    <>
      <div className="adm-head">
        <h1>新增教案</h1>
        <Link href="/admin/lessons" className="adm-link">← 回教案庫</Link>
      </div>
      <LessonForm
        categories={categories}
        tags={tags}
        init={{
          title: "", category_id: cat?.id ?? "", levels: cat?.levels ?? [], difficulty: null, minutes: 90,
          summary: "", goals: "", refs: "", steps: [], challenge: "", support: "", materials: [], tips: "",
          xp: 10, status: "draft", tags: [],
        }}
      />
    </>
  );
}

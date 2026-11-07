import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import { categoryLabel, type Category } from "@/lib/lessons";
import BulkImport from "./BulkImport";

export const metadata = { title: "從資料夾匯入照片與 .io" };

// 管理員工具：選電腦裡的教案資料夾，依子資料夾名稱對應到教案，一次上傳成品照片與 .io
export default async function ImportFilesPage() {
  await requireStaff(true);
  const [categories, lessons, files] = await Promise.all([
    sbGet<Category[]>("lesson_categories?select=id,major,name,levels,sort,active&order=major,sort,name"),
    sbGet<{ id: string; title: string; category_id: string | null }[]>(
      "lessons?status=neq.archived&select=id,title,category_id&order=title&limit=2000",
    ),
    sbGet<{ lesson_id: string; file_name: string | null }[]>("lesson_files?kind=in.(image,model_io)&select=lesson_id,file_name"),
  ]);
  const existing: Record<string, string[]> = {};
  for (const f of files) if (f.file_name) (existing[f.lesson_id] ??= []).push(f.file_name);
  const def = categories.find((c) => c.major === "lego" && c.name === "幼兒大積木") ?? categories[0];

  return (
    <>
      <div className="adm-head">
        <h1>從資料夾匯入照片與 .io</h1>
        <Link href="/admin/lessons" className="adm-link">← 教案庫</Link>
      </div>
      <div className="adm-panel">
        <ol className="lsn-steps-help">
          <li>選擇課程類別（例如 LEGO・幼兒大積木）。</li>
          <li>按「選擇資料夾」，選電腦裡放教案的資料夾（例如 <code>D:\樂高課程\幼兒積木\課程教案</code>）。瀏覽器會問是否上傳，按「上傳」（檔案要等你按下「開始上傳」才會送出）。</li>
          <li>系統依「子資料夾名稱」對應到同名教案；對不到或對錯的，可以在表格裡改選。</li>
          <li>只會上傳照片（PNG／JPG／WebP）與 .io；PDF、Word 等其他檔案會略過。教案裡已經有同名檔案的也會略過，所以重複執行沒關係。</li>
        </ol>
      </div>
      <BulkImport
        categories={categories.filter((c) => c.active).map((c) => ({ id: c.id, label: categoryLabel(c) }))}
        defaultCategory={def?.id ?? ""}
        lessons={lessons}
        existing={existing}
      />
    </>
  );
}

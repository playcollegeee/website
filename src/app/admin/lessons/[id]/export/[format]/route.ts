import { NextResponse } from "next/server";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbGet } from "@/lib/supabase";
import { buildDocx } from "@/lib/docx";
import { EXPORT_FORMATS, buildExport, type ExportFormat, type ExportLesson } from "@/lib/lessonExport";

// 匯出教案成 Word 檔（三種外部單位常用表格）
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; format: string }> }) {
  const staff = await requireStaff();
  const { id, format } = await params;
  if (!isUuid(id) || !(format in EXPORT_FORMATS)) return new NextResponse("找不到", { status: 404 });
  const rows = await sbGet<(Omit<ExportLesson, "major"> & { category: { major: string } | null })[]>(
    `lessons?id=eq.${id}&select=title,levels,minutes,goals,timeline,materials,parent_note,outline,summary,category:lesson_categories(major)`,
  );
  const l = rows[0];
  if (!l) return new NextResponse("找不到教案", { status: 404 });
  const fmt = format as ExportFormat;
  const teacher = staff.nickname ? `${staff.name}（${staff.nickname}）` : staff.name;
  const file = buildDocx(buildExport(fmt, { ...l, major: l.category?.major ?? null }, teacher));
  await audit(actorOf(staff), "lesson.export", `lessons:${id}`, { format: fmt });
  const name = `${l.title}_${EXPORT_FORMATS[fmt].label}.docx`.replace(/[\\/:*?"<>|]/g, "_");
  return new NextResponse(Buffer.from(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="lesson.docx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}

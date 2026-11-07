import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet, sbSignUrl } from "@/lib/supabase";
import { LESSON_BUCKET } from "@/lib/lessons";

// 下載教案檔案（.io 或照片原檔）：確認是在職老師後，轉到 60 秒有效的私人連結
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("找不到檔案", { status: 404 });
  const rows = await sbGet<{ storage_path: string; file_name: string | null }[]>(
    `lesson_files?id=eq.${id}&select=storage_path,file_name`,
  );
  if (!rows[0]) return new NextResponse("找不到檔案", { status: 404 });
  const url = await sbSignUrl(LESSON_BUCKET, rows[0].storage_path, 60, rows[0].file_name ?? "");
  if (!url) return new NextResponse("暫時無法下載，請稍後再試", { status: 502 });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}

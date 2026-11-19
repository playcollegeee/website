import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/staff";
import { isUuid, sbGet, sbSignUrl } from "@/lib/supabase";
import { REF_BUCKET } from "@/lib/planRefs";

// 打開／下載參考檔案：確認是在職老師後，轉到 60 秒有效的私人連結（?dl=1 用原檔名下載，沒有就在瀏覽器開）
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("找不到檔案", { status: 404 });
  const rows = await sbGet<{ file_path: string | null; file_name: string | null }[]>(
    `plan_refs?id=eq.${id}&kind=eq.file&select=file_path,file_name`,
  );
  if (!rows[0]?.file_path) return new NextResponse("找不到檔案", { status: 404 });
  const dl = new URL(req.url).searchParams.get("dl") === "1";
  const url = await sbSignUrl(REF_BUCKET, rows[0].file_path, 60, dl ? rows[0].file_name ?? "" : undefined);
  if (!url) return new NextResponse("暫時無法開啟，請稍後再試", { status: 502 });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}

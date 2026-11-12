import { redirect } from "next/navigation";

// 舊的白板網址：白板已併入會議室
export default async function OldBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/meetings/${id}`);
}

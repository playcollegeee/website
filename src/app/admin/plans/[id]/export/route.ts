import { NextResponse } from "next/server";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbGet } from "@/lib/supabase";
import { buildDocx, type Block, type Row } from "@/lib/docx";
import {
  CAMP_SLOTS, LIST_SECTIONS, MAJOR_SECTIONS, PLAN_KIND_LABEL, PLAN_STATUS_LABEL, SECTIONS, campDays, fmtDay, fmtRange, who,
  type Plan, type PlanItem,
} from "@/lib/plans";

// 匯出規劃給外部講師：主題、日期、內容（教案名稱、負責老師、流程與材料）、決議。
// 內部留言與待辦不匯出。
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("找不到", { status: 404 });
  const [plans, items, decisions] = await Promise.all([
    sbGet<Plan[]>(`plans?id=eq.${id}&select=*,owner:teachers!plans_owner_id_fkey(name,nickname)`),
    sbGet<PlanItem[]>(
      `plan_items?plan_id=eq.${id}&select=*,lesson:lessons(id,title),teacher:teachers!plan_items_teacher_id_fkey(name,nickname)&order=day.nullslast,seq,created_at`,
    ),
    sbGet<{ body: string }[]>(`plan_comments?plan_id=eq.${id}&is_decision=eq.true&select=body&order=decided_at`),
  ]);
  const p = plans[0];
  if (!p) return new NextResponse("找不到規劃", { status: 404 });

  const lines = (it?: PlanItem) => {
    if (!it) return ["（尚未安排）"];
    return [
      it.title ?? "",
      it.lesson ? `教案：${it.lesson.title}` : "",
      it.teacher_id ? `負責老師：${who(it.teacher ?? null)}` : "",
      ...(it.notes ? it.notes.split("\n") : []),
    ].filter(Boolean);
  };
  const blocks: Block[] = [
    { type: "title", text: `${PLAN_KIND_LABEL[p.kind]}｜${p.title}${p.theme ? `・${p.theme}` : ""}` },
    { type: "subtitle", text: `玩學院 Play Collegeee` },
    {
      type: "table",
      rows: [
        { label: "主題", lines: [p.theme ?? "（討論中）"] },
        { label: "日期", lines: [fmtRange(p.start_date, p.end_date)] },
        { label: "狀態", lines: [PLAN_STATUS_LABEL[p.status]] },
        { label: "負責老師", lines: [p.owner_id ? who(p.owner ?? null) : ""] },
        { label: "主題說明", lines: (p.summary ?? "").split("\n") },
      ],
    },
  ];
  if (p.kind === "season") {
    for (const sec of MAJOR_SECTIONS) {
      const list = items.filter((x) => x.section === sec);
      if (!list.length) continue;
      blocks.push({
        type: "table",
        rows: [{ label: SECTIONS[sec].label, lines: [], header: true }, ...list.map((it): Row => ({ label: `第 ${it.seq} 堂`, lines: lines(it) }))],
      });
    }
  }
  for (const sec of LIST_SECTIONS[p.kind as "season" | "month" | "camp"]) {
    const list = items.filter((x) => x.section === sec);
    if (!list.length) continue;
    blocks.push({
      type: "table",
      rows: [{ label: SECTIONS[sec].label, lines: [], header: true }, ...list.map((it): Row => ({ label: it.day ? fmtDay(it.day) : "日期未定", lines: lines(it) }))],
    });
  }
  if (p.kind === "camp") {
    for (const w of campDays(p.start_date, p.end_date)) {
      const rows: Row[] = [{ label: `第 ${w.week} 週`, lines: [], header: true }];
      for (const d of w.days) {
        for (const s of CAMP_SLOTS) {
          rows.push({ label: `${fmtDay(d)} ${s.label}\n${s.time}`.split("\n").join(" "), lines: lines(items.find((x) => x.section === "camp" && x.day === d && x.slot === s.value)) });
        }
      }
      blocks.push({ type: "table", rows, labelWidth: 2300 });
    }
  }
  if (decisions.length) {
    blocks.push({ type: "table", rows: [{ label: "決議事項", lines: [], header: true }, ...decisions.map((d, i): Row => ({ label: String(i + 1), lines: d.body.split("\n") }))] });
  }

  const file = buildDocx(blocks);
  await audit(actorOf(staff), "plan.export", `plans:${id}`, {});
  const name = `${PLAN_KIND_LABEL[p.kind]}_${p.title}${p.theme ? `_${p.theme}` : ""}.docx`.replace(/[\\/:*?"<>|]/g, "_");
  return new NextResponse(Buffer.from(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="plan.docx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}

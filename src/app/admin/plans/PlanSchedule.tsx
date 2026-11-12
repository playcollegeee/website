import {
  CAMP_SLOTS, LIST_SECTIONS, MAJOR_LESSONS, MAJOR_SECTIONS, SECTIONS, campDays, fmtDay,
  type Plan, type PlanComment, type PlanItem,
} from "@/lib/plans";
import ItemCard, { type LessonOpt } from "./ItemCard";

type T = { id: string; name: string; nickname: string | null };

// 時程安排（主修 12 堂、走讀／工作坊、故事屋／動滋動、營隊每天上下午）：規劃頁與會議室共用，改的是同一份資料
export default function PlanSchedule({
  plan, items, comments, teachers, lessons, me, isAdmin, editable,
}: {
  plan: Plan; items: PlanItem[]; comments: PlanComment[]; teachers: T[]; lessons: LessonOpt[]; me: string; isAdmin: boolean; editable: boolean;
}) {
  const cOf = (itemId: string) => comments.filter((c) => c.item_id === itemId);
  const common = { planId: plan.id, canEditPlan: editable, me, isAdmin, lessons, teachers };
  return (
    <>
          {plan.kind === "season" && MAJOR_SECTIONS.map((sec) => (
            <details key={sec} className="adm-panel pln-sec" open={items.some((x) => x.section === sec)}>
              <summary><h2>{SECTIONS[sec].label} <small>已安排 {items.filter((x) => x.section === sec && (x.title || x.lesson_id)).length}／{MAJOR_LESSONS}</small></h2></summary>
              {Array.from({ length: MAJOR_LESSONS }, (_, i) => i + 1).map((n) => {
                const it = items.find((x) => x.section === sec && x.seq === n);
                return <ItemCard key={`${sec}-${n}-${it?.updated_at ?? ""}`} {...common} section={sec} seq={n} label={`第 ${n} 堂`} item={it} comments={it ? cOf(it.id) : []} />;
              })}
            </details>
          ))}

          {LIST_SECTIONS[plan.kind as "season" | "month" | "camp"].map((sec) => {
            const list = items.filter((x) => x.section === sec);
            return (
              <section key={sec} className="adm-panel pln-sec">
                <h2>{SECTIONS[sec].label} <small>{list.length} 場</small></h2>
                {list.length === 0 && <p className="muted">還沒有安排。</p>}
                {list.map((it) => <ItemCard key={`${it.id}-${it.updated_at}`} {...common} section={sec} item={it} comments={cOf(it.id)} />)}
                <ItemCard {...common} section={sec} isNew comments={[]} />
              </section>
            );
          })}

          {plan.kind === "camp" && (() => {
            const weeks = campDays(plan.start_date, plan.end_date);
            if (!weeks.length) return <p className="notice err">請先按「編輯名稱、主題與日期」設定營隊的開始與結束日期，系統會排出每週每天的上午、下午。</p>;
            return weeks.map((w) => (
              <details key={w.week} className="adm-panel pln-sec" open>
                <summary><h2>第 {w.week} 週 <small>{fmtDay(w.days[0])} ～ {fmtDay(w.days[w.days.length - 1])}</small></h2></summary>
                {w.days.map((d) => (
                  <div key={d} className="pln-day">
                    <h3>{fmtDay(d)}</h3>
                    {CAMP_SLOTS.map((s) => {
                      const it = items.find((x) => x.section === "camp" && x.day === d && x.slot === s.value);
                      return <ItemCard key={`${d}-${s.value}-${it?.updated_at ?? ""}`} {...common} section="camp" day={d} slot={s.value}
                        label={`${s.label} ${s.time}`} item={it} comments={it ? cOf(it.id) : []} />;
                    })}
                  </div>
                ))}
              </details>
            ));
          })()}
    </>
  );
}

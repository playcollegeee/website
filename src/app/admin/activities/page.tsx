import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { sbGet } from "@/lib/supabase";
import { AUDIENCE_LABEL, type Activity } from "@/lib/activities";
import { deleteActivity, moveActivity, saveActivity } from "./actions";
import ActivityEditor from "./ActivityEditor";

export const metadata = { title: "活動與工作坊" };

// 後台：官網「活動與工作坊」頁的卡片管理（管理員）
export default async function ActivitiesAdminPage() {
  await requireStaff(true);
  let list: Activity[] = [];
  let error = "";
  try {
    list = await sbGet<Activity[]>("activities?order=sort,created_at&select=*");
  } catch (e) {
    error = e instanceof Error ? e.message : "讀取失敗";
  }

  return (
    <>
      <div className="adm-head">
        <h1>活動與工作坊</h1>
        <div className="adm-actions">
          <Link className="btn btn-sm" href="/workshops" target="_blank">看官網活動頁 ↗</Link>
        </div>
      </div>
      <p className="hint">
        官網「活動與工作坊」頁的每一張卡片。依對象分組顯示：兒童與親子 → 大人小孩都可以 → 成人。存檔後官網馬上更新；取消勾選「顯示在官網」可以先藏起來。
      </p>
      <p className="adm-warn">⚠ 費用還沒定案前先不要填；照片有孩子入鏡請先確認家長的照片公開設定。</p>

      {error ? (
        <div className="notice err">
          {error}。如果是第一次使用，請先在 Supabase 執行 <code>supabase/migrations/0015_activities.sql</code>。
        </div>
      ) : (
        <>
          <h2 className="ph-h">新增一個活動</h2>
          <ActivityEditor key="new" save={saveActivity} />

          <h2 className="ph-h">目前的活動（{list.length}）</h2>
          {list.length === 0 && <p className="adm-empty">還沒有活動，官網會先顯示空白。</p>}
          <div className="ph-list">
            {list.map((a, i) => (
              <div key={`${a.id}-${a.image_url}-${a.sort}`}>
                <p className="hint act-aud">{AUDIENCE_LABEL[a.audience]}{a.published ? "" : "（未顯示）"}</p>
                <ActivityEditor activity={a} save={saveActivity} move={moveActivity} remove={deleteActivity} isFirst={i === 0} isLast={i === list.length - 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

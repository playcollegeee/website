import { RELATIONS } from "@/lib/admin";

// 新增家長的欄位（name 前面加 g_，避免和學生欄位撞名）
export default function GuardianFields() {
  return (
    <div className="adm-grid">
      <div className="field">
        <label htmlFor="g_name">家長姓名 *</label>
        <input id="g_name" name="g_name" required maxLength={40} />
      </div>
      <div className="field">
        <label htmlFor="g_relation">關係</label>
        <select id="g_relation" name="g_relation" defaultValue="媽媽">
          {RELATIONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="g_phone">手機 *</label>
        <input id="g_phone" name="g_phone" required type="tel" inputMode="tel" pattern="[0-9+\-\s()]{8,20}" />
        <small>已登記過的電話會自動連到同一位家長（兄弟姊妹）</small>
      </div>
      <div className="field">
        <label htmlFor="g_email">Email</label>
        <input id="g_email" name="g_email" type="email" maxLength={120} />
      </div>
    </div>
  );
}

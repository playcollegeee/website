import { DEFAULT_PHOTO_SCOPE, PHOTO_SCOPES } from "@/lib/consent";

// 後台：照片公開範圍與照護注意事項
export default function ConsentFields({
  photoScope = DEFAULT_PHOTO_SCOPE,
  careNotes = "",
  careConsented = false,
}: {
  photoScope?: string;
  careNotes?: string | null;
  careConsented?: boolean;
}) {
  return (
    <div className="adm-grid">
      <div className="field">
        <label htmlFor="photo_scope">照片與作品公開</label>
        <select id="photo_scope" name="photo_scope" defaultValue={photoScope}>
          {PHOTO_SCOPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <small>預設公開；家長表示不同意時改這裡</small>
      </div>
      <div className="field adm-wide">
        <label htmlFor="care_notes">照護注意事項（過敏、特殊需求）</label>
        <textarea id="care_notes" name="care_notes" rows={2} maxLength={500} defaultValue={careNotes ?? ""} />
        <label className="adm-check">
          <input type="checkbox" name="care_consent" defaultChecked={careConsented} /> 家長已同意記錄（填寫時必勾）
        </label>
        <small>屬個資法第 6 條特種資料：只在家長主動提供並同意時記錄，點名頁會提醒老師</small>
      </div>
    </div>
  );
}

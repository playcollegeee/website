import { LEVEL_OPTIONS } from "@/lib/admin";

export type StudentValues = {
  name?: string;
  nickname?: string;
  level?: string;
  birth_year?: number | null;
  gender?: string | null;
  school?: string | null;
  notes?: string | null;
};

// 新增與編輯共用的學生欄位
export default function StudentFields({ v = {} }: { v?: StudentValues }) {
  return (
    <div className="adm-grid">
      <div className="field">
        <label htmlFor="name">真實姓名 *</label>
        <input id="name" name="name" required maxLength={40} defaultValue={v.name} />
        <small>只有老師與家長看得到</small>
      </div>
      <div className="field">
        <label htmlFor="nickname">角色暱稱 *</label>
        <input id="nickname" name="nickname" required maxLength={20} defaultValue={v.nickname} placeholder="例：閃電小明" />
        <small>會出現在讀卡站、角色卡與英雄榜，不要用全名</small>
      </div>
      <div className="field">
        <label htmlFor="level">階段 *</label>
        <select id="level" name="level" required defaultValue={v.level ?? ""}>
          <option value="" disabled>請選擇</option>
          {LEVEL_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="birth_year">出生年（西元）</label>
        <input id="birth_year" name="birth_year" inputMode="numeric" pattern="\d{4}" maxLength={4} defaultValue={v.birth_year ?? ""} placeholder="2017" />
      </div>
      <div className="field">
        <label htmlFor="gender">性別</label>
        <select id="gender" name="gender" defaultValue={v.gender ?? ""}>
          <option value="">不填</option>
          <option value="男">男</option>
          <option value="女">女</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="school">就讀學校</label>
        <input id="school" name="school" maxLength={60} defaultValue={v.school ?? ""} />
      </div>
      <div className="field adm-wide">
        <label htmlFor="notes">注意事項</label>
        <textarea id="notes" name="notes" rows={3} maxLength={1000} defaultValue={v.notes ?? ""} placeholder="接送、過敏、需要特別留意的地方" />
      </div>
    </div>
  );
}

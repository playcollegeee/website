"use client";

import { useState } from "react";

// 選擇課程系列；選「新增課程」時展開新課程欄位
export default function CourseChooser({
  courses, kinds, majors, levels,
}: {
  courses: { id: string; label: string }[];
  kinds: [string, string][];
  majors: [string, string][];
  levels: [string, string][];
}) {
  const [v, setV] = useState(courses.length ? "" : "new");
  return (
    <div className="adm-grid">
      <div className="field adm-wide">
        <label htmlFor="course_id">課程系列 *</label>
        <select id="course_id" name="course_id" required value={v} onChange={(e) => setV(e.target.value)}>
          <option value="" disabled>請選擇</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          <option value="new">＋ 新增課程系列…</option>
        </select>
      </div>
      {v === "new" && (
        <>
          <div className="field">
            <label htmlFor="course_title">課程名稱 *</label>
            <input id="course_title" name="course_title" required maxLength={60} placeholder="例：LEGO 機械與動力" />
          </div>
          <div className="field">
            <label htmlFor="course_kind">類型 *</label>
            <select id="course_kind" name="course_kind" defaultValue="major">
              {kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="course_major">主修（對應角色職業）</label>
            <select id="course_major" name="course_major" defaultValue="lego">
              {majors.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              <option value="">不屬於主修</option>
            </select>
          </div>
          <fieldset className="field adm-levels">
            <legend>適合階段 *</legend>
            {levels.map(([k, l]) => (
              <label key={k}><input type="checkbox" name="course_levels" value={k} /> {l}</label>
            ))}
          </fieldset>
        </>
      )}
    </div>
  );
}

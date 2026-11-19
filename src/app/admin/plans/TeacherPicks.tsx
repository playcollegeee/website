"use client";

type T = { id: string; name: string; nickname: string | null };

// 負責老師複選（2026-11-19）：每位老師一顆按鈕，按一下選取、再按一下取消
export default function TeacherPicks({
  teachers, value, onChange, label = "負責老師", disabled,
}: {
  teachers: T[]; value: string[]; onChange: (ids: string[]) => void; label?: string; disabled?: boolean;
}) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <span className="pln-picks" role="group" aria-label={label}>
      {teachers.map((t) => {
        const on = value.includes(t.id);
        return (
          <button key={t.id} type="button" className={`pln-pick${on ? " on" : ""}`} aria-pressed={on} disabled={disabled}
            onClick={() => toggle(t.id)}>
            {on ? "✓ " : ""}{t.nickname || t.name}
          </button>
        );
      })}
      {value.length === 0 && <small className="muted">（未指派）</small>}
    </span>
  );
}

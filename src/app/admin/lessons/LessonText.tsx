// 多行文字：網址變成可點的連結（教案頁與合作單位版共用）
export default function Text({ v }: { v: string | null }) {
  if (!v) return <span className="muted">—</span>;
  return (
    <div className="lsn-text">
      {v.split("\n").map((line, i) => {
        const t = line.trim();
        return (
          <p key={i}>
            {/^https?:\/\/\S+$/.test(t) ? <a href={t} target="_blank" rel="noopener noreferrer">{t}</a> : line || " "}
          </p>
        );
      })}
    </div>
  );
}

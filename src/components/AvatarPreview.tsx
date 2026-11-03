// 角色養成系統的示意圖：角色由「身體」與「裝備」分層疊成。
// 之後正式版會從資料庫讀取學生的裝備清單，把每一層圖片疊上去。

type Props = { gear?: Array<"helmet" | "gauntlet" | "cape" | "boots"> };

export default function AvatarPreview({ gear = ["helmet", "gauntlet", "cape", "boots"] }: Props) {
  const has = (g: NonNullable<Props["gear"]>[number]) => gear.includes(g);
  return (
    <svg viewBox="0 0 240 300" role="img" aria-label="積木角色示意圖" style={{ width: "100%", maxWidth: 320 }}>
      {/* 披風（最底層） */}
      {has("cape") && <path d="M70 120 L170 120 L190 250 L50 250 Z" fill="#5098d2" opacity="0.9" />}
      {/* 腿與靴子 */}
      <rect x="88" y="200" width="26" height="56" rx="6" fill="#5f6368" />
      <rect x="126" y="200" width="26" height="56" rx="6" fill="#5f6368" />
      {has("boots") && (
        <>
          <rect x="82" y="240" width="36" height="22" rx="6" fill="#ea5754" />
          <rect x="122" y="240" width="36" height="22" rx="6" fill="#ea5754" />
        </>
      )}
      {/* 身體 */}
      <rect x="78" y="118" width="84" height="90" rx="12" fill="#5cbeaa" />
      <rect x="104" y="140" width="32" height="32" rx="6" fill="#fff" opacity="0.6" />
      {/* 手臂 */}
      <rect x="54" y="124" width="22" height="66" rx="10" fill="#5cbeaa" />
      <rect x="164" y="124" width="22" height="66" rx="10" fill="#5cbeaa" />
      {/* 齒輪拳套 */}
      {has("gauntlet") && (
        <g>
          <circle cx="175" cy="196" r="18" fill="#fbc20f" />
          <circle cx="175" cy="196" r="7" fill="#fff" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <rect key={a} x="171" y="172" width="8" height="10" rx="2" fill="#fbc20f" transform={`rotate(${a} 175 196)`} />
          ))}
        </g>
      )}
      {/* 頭 */}
      <rect x="86" y="50" width="68" height="64" rx="14" fill="#ffd9b8" />
      <circle cx="108" cy="82" r="5" fill="#2b2b2b" />
      <circle cx="132" cy="82" r="5" fill="#2b2b2b" />
      <path d="M108 98 Q120 106 132 98" stroke="#2b2b2b" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* 頭盔：學院屋頂造型 */}
      {has("helmet") && (
        <g>
          <path d="M80 56 L120 22 L160 56 Z" fill="#fbc20f" />
          <rect x="80" y="54" width="80" height="10" rx="4" fill="#fbc20f" />
        </g>
      )}
    </svg>
  );
}

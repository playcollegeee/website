import Link from "next/link";

// 右下角常駐的預約按鈕，捲到哪裡都按得到
export default function FloatingCta() {
  return (
    <Link href="/contact?type=trial" className="fab" aria-label="預約試聽">
      <span aria-hidden="true">✦</span> 預約試聽
    </Link>
  );
}

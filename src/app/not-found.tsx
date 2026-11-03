import Link from "next/link";

export default function NotFound() {
  return (
    <section>
      <div className="container">
        <p className="eyebrow">404</p>
        <h1>這塊積木好像不見了</h1>
        <p className="lead">找不到這個頁面，可能已經搬家了。</p>
        <div className="btn-row">
          <Link href="/" className="btn primary">
            回到首頁
          </Link>
        </div>
      </div>
    </section>
  );
}

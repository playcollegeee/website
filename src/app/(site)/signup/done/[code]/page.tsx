import type { Metadata } from "next";
import Link from "next/link";
import CopyButton from "@/components/CopyButton";
import PayReportForm from "@/components/PayReportForm";
import { site } from "@/lib/content";
import { canPay, fmtTimes, getBookingByToken, getSettings, gradeLabel, money, runTitle } from "@/lib/events";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "報名查詢", robots: { index: false, follow: false } };

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string }> };

// 家長的報名查詢頁：報名完成後自動帶到這裡，也可以用私訊裡的連結回來看狀態、回填末五碼
export default async function BookingDonePage({ params, searchParams }: Props) {
  const { code } = await params;
  const { t } = await searchParams;
  const found = await getBookingByToken(code.toUpperCase(), t ?? "").catch(() => null);

  if (!found) {
    return (
      <section>
        <div className="container su-narrow">
          <h1>找不到這筆報名</h1>
          <p className="lead">請確認連結是否完整（從私訊或 Email 裡的連結點進來），或直接私訊我們。</p>
          <div className="btn-row">
            <a className="btn primary" href={site.facebook} target="_blank" rel="noopener noreferrer">私訊 FB 粉專</a>
            <a className="btn" href={site.instagram} target="_blank" rel="noopener noreferrer">私訊 IG</a>
          </div>
        </div>
      </section>
    );
  }

  const { booking: b, people, run, theme, slot } = found;
  const settings = await getSettings();
  const title = runTitle(run, theme);
  const payable = canPay(b, run, slot);
  const dmText = `您好，我已報名「${title}」${slot ? `（${slot.label}）` : ""}，報名編號 ${b.code}，參加者：${people.map((p) => p.name).join("、")}。`;

  const head: Record<string, { h: string; p: string; cls: string }> = {
    registered: { h: "報名資料收到了！", p: "確定開課後我們會私訊通知您匯款資訊，目前不用先匯款。", cls: "ok" },
    pending: payable
      ? { h: "報名資料收到了！請完成匯款", p: "匯款後在下方填帳號末五碼，我們對帳後會私訊通知您報名完成。", cls: "ok" }
      : { h: "報名資料收到了！", p: "確定開課後我們會私訊通知您匯款資訊。", cls: "ok" },
    paid: { h: "報名完成 🎉", p: "已收到您的款項，上課前我們會再提醒您。", cls: "ok" },
    waitlist: { h: "已幫您登記候補", p: "目前名額已滿，有名額釋出會第一時間私訊通知您，不用先匯款。", cls: "ok" },
    cancelled: { h: "這筆報名已取消", p: b.cancel_reason ? `原因：${b.cancel_reason}` : "有疑問請私訊我們。", cls: "err" },
    refunded: { h: "這筆報名已取消並退款", p: b.refund_amount !== null ? `退款金額 ${money(b.refund_amount)} 元。` : "", cls: "err" },
  };
  const h = head[b.status];

  return (
    <section>
      <div className="container su-narrow">
        <p className="eyebrow">報名查詢</p>
        <h1>{title}</h1>
        <div className={`notice ${h.cls} pop-in`}>
          <p style={{ margin: 0 }}>{h.h}</p>
          <p style={{ margin: "6px 0 0", fontWeight: 400 }}>{h.p}</p>
        </div>

        <div className="card su-receipt">
          <dl className="su-facts">
            <div><dt>報名編號</dt><dd><strong className="su-code">{b.code}</strong></dd></div>
            {slot && (
              <div>
                <dt>{slot.label}</dt>
                <dd>
                  {fmtTimes(slot.times)}
                  {(slot.venue || slot.address) && <><br />{[slot.venue, slot.address].filter(Boolean).join("，")}</>}
                </dd>
              </div>
            )}
            <div>
              <dt>參加者</dt>
              <dd>{people.map((p) => `${p.name}${p.grade !== null ? `（${gradeLabel(p.grade)}）` : p.kind === "adult" ? "（大人）" : ""}`).join("、")}</dd>
            </div>
            <div><dt>方案</dt><dd>{b.price_label}{b.qty > 1 ? ` × ${b.qty}` : ""}</dd></div>
            <div><dt>應繳金額</dt><dd><strong>${money(b.amount)}</strong></dd></div>
            {theme.notes_text && (<div><dt>備註</dt><dd>{theme.notes_text}</dd></div>)}
          </dl>
        </div>

        {payable && (
          <div className="card su-receipt">
            <h2 className="su-h">匯款資訊</h2>
            {settings.bank?.trim() ? <p className="su-pre">{settings.bank}</p> : <p className="hint">匯款資訊會由我們私訊提供給您。</p>}
            <PayReportForm code={b.code} token={t ?? ""} current={b.pay_last5} />
          </div>
        )}

        {["registered", "pending", "waitlist", "paid"].includes(b.status) && (
          <div className="card su-receipt">
            <h2 className="su-h">別忘了私訊我們「已報名」</h2>
            <p className="hint">私訊後我們才能傳送匯款確認與上課提醒給您。可以直接複製下面這段：</p>
            <p className="su-dm">{dmText}</p>
            <div className="btn-row">
              <CopyButton text={dmText} label="複製訊息" className="btn" />
              <a className="btn primary" href={site.facebook} target="_blank" rel="noopener noreferrer">私訊 FB 粉專</a>
              <a className="btn" href={site.instagram} target="_blank" rel="noopener noreferrer">私訊 IG</a>
            </div>
          </div>
        )}

        <p className="hint">
          請把這一頁加入書籤，之後可以回來查看報名狀態。<Link href="/workshops">看看其他活動</Link>
        </p>
      </div>
    </section>
  );
}

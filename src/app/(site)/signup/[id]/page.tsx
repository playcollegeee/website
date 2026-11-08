import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SignupForm from "@/components/SignupForm";
import { site } from "@/lib/content";
import { fmtTimes, getRunBundle, getSettings, runTitle, WHO_LABEL } from "@/lib/events";
import { isUuid } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const b = isUuid(id) ? await getRunBundle(id).catch(() => null) : null;
  if (!b || b.run.status === "draft") return { title: "活動報名" };
  return { title: `報名｜${runTitle(b.run, b.theme)}`, description: b.run.intro || b.theme.summary };
}

// 官網：一次開課的報名頁（左邊課程資訊、右邊報名表；手機上下排列）
export default async function SignupPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const bundle = await getRunBundle(id).catch(() => null);
  if (!bundle || bundle.run.status === "draft") notFound();
  const { run, theme, slots: allSlots } = bundle;
  const slots = allSlots.filter((s) => s.state !== "cancelled");
  const settings = await getSettings();
  const title = runTitle(run, theme);
  const cover = run.cover_url || theme.cover_url;
  const open = run.status === "open";

  return (
    <section>
      <div className="container su-layout">
        <div className="su-info">
          <p className="eyebrow">活動報名</p>
          <h1>{title}</h1>
          {cover && (
            <div className="su-cover">
              <Image src={cover} alt={`${title}活動照片`} width={1200} height={900} sizes="(max-width: 960px) 100vw, 520px" priority />
            </div>
          )}
          <p className="lead">{run.intro || theme.summary}</p>
          <dl className="su-facts">
            {theme.audience_text && (<div><dt>適合對象</dt><dd>{theme.audience_text}（{WHO_LABEL[run.who]}）</dd></div>)}
            {theme.duration_text && (<div><dt>時間長度</dt><dd>{theme.duration_text}</dd></div>)}
            {slots.map((s) => (
              <div key={s.id}>
                <dt>{s.label}</dt>
                <dd>
                  {fmtTimes(s.times)}
                  {(s.venue || s.address) && <><br />{[s.venue, s.address].filter(Boolean).join("，")}</>}
                </dd>
              </div>
            ))}
            {run.prices.length > 0 && (
              <div>
                <dt>費用</dt>
                <dd>
                  {run.prices.map((p) => (
                    <span key={p.key} className="su-fee">{p.label} ${p.amount.toLocaleString("en-US")}</span>
                  ))}
                </dd>
              </div>
            )}
            {theme.includes_text && (<div><dt>費用已含</dt><dd>{theme.includes_text}</dd></div>)}
            {theme.notes_text && (<div><dt>備註</dt><dd>{theme.notes_text}</dd></div>)}
            {run.deadline && (<div><dt>報名截止</dt><dd>{run.deadline.replaceAll("-", "/")}</dd></div>)}
          </dl>
          {theme.highlights.length > 0 && (
            <>
              <h2 className="su-h">課程特色</h2>
              <ul className="su-highlights">
                {theme.highlights.map((h) => <li key={h}>{h}</li>)}
              </ul>
            </>
          )}
          <p className="hint">
            最低開課人數：{slots.map((s) => `${s.label} ${s.min_seats} ${run.unit === "group" ? "組" : "人"}`).join("、")}。未達開課人數會在開課前通知並全額退費。
          </p>
          {settings.team && (
            <>
              <h2 className="su-h">團隊介紹</h2>
              <p className="su-pre hint">{settings.team}</p>
            </>
          )}
          <p className="hint">
            有問題歡迎私訊 <a href={site.facebook} target="_blank" rel="noopener noreferrer">FB 粉專</a> 或{" "}
            <a href={site.instagram} target="_blank" rel="noopener noreferrer">IG</a>。
            {theme.showcase !== "none" && <> 看看<Link href={`/workshops/${theme.slug}`}>這個主題的更多照片</Link>。</>}
          </p>
        </div>

        <div className="su-form-wrap card">
          {open && slots.length > 0 && run.prices.length > 0 ? (
            <SignupForm
              runId={run.id}
              who={run.who}
              unit={run.unit}
              payMode={run.pay_mode}
              prices={run.prices}
              questions={run.questions ?? []}
              refundText={run.refund_text || settings.refund || ""}
              slots={slots.map((s) => ({
                id: s.id,
                label: s.label,
                timesText: fmtTimes(s.times),
                place: [s.venue, s.area].filter(Boolean).join("・"),
                left: s.left,
                capacity: s.capacity,
                waitlist: s.waitlist,
                confirmed: s.state === "confirmed",
              }))}
            />
          ) : (
            <div>
              <h2>{run.status === "done" ? "這個活動已經結束了" : "目前沒有開放報名"}</h2>
              <p className="hint">想參加下一場嗎？</p>
              <div className="btn-row">
                {theme.showcase !== "none" ? (
                  <Link className="btn primary" href={`/workshops/${theme.slug}#interest`}>我想上這堂</Link>
                ) : (
                  <Link className="btn primary" href="/workshops">看其他活動</Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

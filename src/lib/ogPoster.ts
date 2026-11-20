import sharp from "sharp";

// 分享預覽圖（貼到 LINE／FB 時出現的那張圖）：把活動海報或封面放在 1200×630 的框裡。
// 海報常是直的，直接當預覽圖會被裁掉上下；這裡用同一張圖放大模糊當底，海報完整放在中間。
// 圖片多是 WebP，產生預覽圖的工具畫不出來，所以用 sharp 轉成 JPEG。

const BASE = "https://playcollegeee.com";
export const OG_SIZE = { width: 1200, height: 630 };

function absolute(url: string) {
  return url.startsWith("http") ? url : `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

async function load(url: string): Promise<Buffer | null> {
  const res = await fetch(absolute(url), { next: { revalidate: 3600 } }).catch(() => null);
  if (!res?.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

function jpeg(buf: Buffer) {
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600, s-maxage=3600" },
  });
}

/** 有海報就做海報版；沒有（或讀不到）就用暖白底＋LOGO */
export async function posterOg(url: string | null | undefined): Promise<Response> {
  const { width, height } = OG_SIZE;
  const img = url ? await load(url) : null;
  if (img) {
    try {
      const bg = await sharp(img).resize(width, height, { fit: "cover" }).blur(28).modulate({ brightness: 0.8 }).toBuffer();
      const fg = await sharp(img).resize(width - 80, height - 50, { fit: "inside" }).toBuffer();
      return jpeg(await sharp(bg).composite([{ input: fg, gravity: "center" }]).jpeg({ quality: 82 }).toBuffer());
    } catch {
      // 圖片壞掉就用下面的 LOGO 版
    }
  }
  const logo = await load("/brand/logo-horizontal.png");
  const canvas = sharp({ create: { width, height, channels: 3, background: "#fdfbf2" } });
  if (!logo) return jpeg(await canvas.jpeg().toBuffer());
  const mark = await sharp(logo).resize(720, 270, { fit: "inside" }).toBuffer();
  return jpeg(await canvas.composite([{ input: mark, gravity: "center" }]).jpeg({ quality: 85 }).toBuffer());
}

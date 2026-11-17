"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const EVERY_MS = 2500; // 開著頁面時每 2.5 秒檢查一次
const HIDDEN_MS = 15000; // 切到別的分頁時放慢

// 會議室自動更新（白板以外）：定期問伺服器資料有沒有變，變了才重新整理。
// router.refresh() 只更新伺服器的資料，老師正在打的字、展開的區塊都會保留。
export default function AutoRefresh({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const last = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`/admin/meetings/${meetingId}/stamp`, { cache: "no-store" });
        if (res.ok) {
          const { stamp } = (await res.json()) as { stamp?: string };
          if (stamp) {
            if (last.current && last.current !== stamp) router.refresh();
            last.current = stamp;
          }
        }
      } catch {
        // 網路斷了就下一輪再試
      }
      if (!stopped) timer = setTimeout(tick, document.visibilityState === "hidden" ? HIDDEN_MS : EVERY_MS);
    };

    const onVis = () => {
      if (document.visibilityState !== "visible" || stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, 50);
    };

    void tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [meetingId, router]);

  return null;
}

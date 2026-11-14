"use client";

import { useState, useTransition } from "react";
import type { SiteFlags } from "@/lib/siteFlags";
import { setFlag } from "./actions";

export default function FlagSwitch({ k, on }: { k: keyof SiteFlags; on: boolean }) {
  const [val, setVal] = useState(on);
  const [msg, setMsg] = useState("");
  const [busy, start] = useTransition();
  return (
    <span className="flag-switch">
      <button
        type="button"
        role="switch"
        aria-checked={val}
        className={`flag-btn${val ? " on" : ""}`}
        disabled={busy}
        onClick={() => {
          const next = !val;
          setVal(next);
          start(async () => {
            const r = await setFlag(k, next);
            if (!r.ok) setVal(!next);
            setMsg(r.message);
          });
        }}
      >
        <span className="flag-knob" aria-hidden="true" />
        {val ? "顯示中" : "已隱藏"}
      </button>
      {msg && <span className="hint" role="status">{msg}</span>}
    </span>
  );
}

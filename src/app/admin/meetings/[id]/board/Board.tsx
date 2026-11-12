"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConfirmButton from "../../../ConfirmButton";
import BoardAiPanel from "./BoardAiPanel";
import { organizeBoard, type BoardAi } from "./actions";
import {
  BOARD_COLORS, BOARD_MAX_ITEMS, NOTE_H, NOTE_MAX, NOTE_W, SECTION_MAX, SYNC_IDLE_MS, SYNC_MS,
  colorOf, edgePoint, inside,
  type BoardColor, type BoardItem, type BoardOp, type Presence, type SyncResult,
} from "@/lib/board";

// 會議討論白板：便利貼＋分區框，多人約 2 秒同步一次。
// 畫面座標 = 白板座標 × 縮放 + 平移。自己的變更先畫上去（樂觀更新），再排隊送到伺服器。

type T = { id: string; name: string; nickname: string | null };
type View = { x: number; y: number; s: number };
type Drag =
  | { mode: "move"; pointerId: number; sx: number; sy: number; moved: boolean; targets: { id: string; ox: number; oy: number }[]; mainId: string }
  | { mode: "resize"; pointerId: number; sx: number; sy: number; id: string; ow: number; oh: number }
  | { mode: "pan"; pointerId: number; sx: number; sy: number; ox: number; oy: number; moved: boolean; wx: number; wy: number };

const MIN_S = 0.25;
const MAX_S = 2.5;
const clampS = (s: number) => Math.min(MAX_S, Math.max(MIN_S, s));
const r = Math.round;
// 這些地方按下去是操作項目；其他地方（含分區框的內部）都當作空白處
const HANDLES = ".bd-note, .bd-sec-head, .bd-resize";

export default function Board({
  meetingId, me, teachers, title, planId = null, canDecide = false, activeTeachers,
}: {
  meetingId: string; me: string; teachers: T[]; title: string;
  planId?: string | null; canDecide?: boolean; activeTeachers?: T[]; // AI 整理套用決議與待辦用
}) {
  const [items, setItems] = useState<Record<string, BoardItem>>({});
  const [loaded, setLoaded] = useState(false);
  const [mod, setMod] = useState(false);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [status, setStatus] = useState<"ok" | "sync" | "err">("sync");
  const [errText, setErrText] = useState("");
  const [view, setView] = useState<View>({ x: 40, y: 40, s: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [color, setColor] = useState<BoardColor>("yellow");
  const [list, setList] = useState(false);
  const [notice, setNotice] = useState("");
  const [full, setFull] = useState(false); // 全螢幕：白板蓋滿整個畫面，按 Esc 或「離開全螢幕」回來
  const [connectFrom, setConnectFrom] = useState<string | null>(null); // 連線模式：起點
  const [ai, setAi] = useState<BoardAi | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const viewRef = useRef(view);
  viewRef.current = view;
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const revRef = useRef(0);
  const queue = useRef<BoardOp[]>([]);
  const inflight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; s: number; cx: number; cy: number; vx: number; vy: number } | null>(null);
  const vpRef = useRef<HTMLDivElement>(null);
  const fullReload = useRef(false);
  const stopped = useRef(false);

  const nameOf = useMemo(() => {
    const m = new Map(teachers.map((t) => [t.id, t.nickname || t.name]));
    return (id: string | null) => (id ? m.get(id) ?? "（已離職）" : "");
  }, [teachers]);

  // 手機預設用條列模式
  useEffect(() => {
    if (window.innerWidth < 760) setList(true);
  }, []);

  // ---------- 同步 ----------
  const schedule = useCallback((ms: number) => {
    if (stopped.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void syncRef.current(), ms);
  }, []);

  const sync = useCallback(async () => {
    if (inflight.current || stopped.current) return;
    inflight.current = true;
    const ops = queue.current;
    queue.current = [];
    const since = fullReload.current ? 0 : revRef.current;
    const reload = fullReload.current;
    fullReload.current = false;
    if (ops.length) setStatus("sync");
    try {
      const res = await fetch(`/admin/meetings/${meetingId}/board/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since, ops, editing: editingRef.current }),
      });
      const j = (await res.json().catch(() => ({}))) as Partial<SyncResult> & { mod?: boolean; error?: string };
      if (!res.ok || !Array.isArray(j.items)) {
        if (res.status === 401) stopped.current = true;
        throw new Error(j.error || "同步失敗，稍後會自動重試");
      }
      // 送出後又有新變更的項目、正在拖或正在編輯的項目，先保留自己畫面上的樣子
      const keep = new Set(queue.current.map((o) => o.id));
      if (drag.current?.mode === "move") drag.current.targets.forEach((t) => keep.add(t.id));
      if (drag.current?.mode === "resize") keep.add(drag.current.id);
      if (editingRef.current) keep.add(editingRef.current);
      setItems((prev) => {
        const next: Record<string, BoardItem> = reload ? {} : { ...prev };
        if (reload) for (const id of keep) if (prev[id]) next[id] = prev[id];
        for (const it of j.items!) {
          if (keep.has(it.id)) continue;
          if (it.deleted) delete next[it.id];
          else next[it.id] = it;
        }
        return next;
      });
      revRef.current = Math.max(reload ? 0 : revRef.current, j.rev ?? 0);
      setPresence(j.presence ?? []);
      setMod(!!j.mod);
      setLoaded(true);
      setStatus("ok");
      setErrText("");
      // 有變更被拒絕（例如權限不足）：下次整塊重新載入，讓畫面回到正確狀態
      if (j.rejected) {
        fullReload.current = true;
        setNotice("有些變更沒有權限，已還原");
      }
    } catch (e) {
      // 沒送出去的變更放回佇列，下次再送
      queue.current = [...ops, ...queue.current];
      setStatus("err");
      setErrText(e instanceof Error ? e.message : "同步失敗");
    } finally {
      inflight.current = false;
      const idle = typeof document !== "undefined" && document.visibilityState === "hidden";
      schedule(queue.current.length ? 150 : idle ? SYNC_IDLE_MS : SYNC_MS);
    }
  }, [meetingId, schedule]);
  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => {
    stopped.current = false;
    void sync();
    const onVis = () => { if (document.visibilityState === "visible") schedule(50); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [sync, schedule]);

  // 排一個變更：同一張的連續拖動、改字合併成一筆
  const push = useCallback((op: BoardOp) => {
    const q = queue.current;
    const i = q.findIndex((o) => o.id === op.id && o.op === op.op && (op.op === "move" || op.op === "edit"));
    if (i >= 0) q[i] = { ...q[i], ...op } as BoardOp;
    else q.push(op);
    schedule(150);
  }, [schedule]);

  // ---------- 權限（畫面先擋，伺服器會再檢查一次） ----------
  const canEdit = (it: BoardItem) => mod || it.author_id === me;
  const canResize = (it: BoardItem) => it.kind === "section" || canEdit(it);

  const maxZ = () => Object.values(itemsRef.current).reduce((m, it) => Math.max(m, it.z), 0);

  // ---------- 新增 ----------
  const centerWorld = () => {
    const vp = vpRef.current?.getBoundingClientRect();
    const v = viewRef.current;
    const w = vp?.width ?? 800;
    const h = vp?.height ?? 500;
    return { x: (w / 2 - v.x) / v.s, y: (h / 2 - v.y) / v.s };
  };

  const freeSpot = (x0: number, y0: number, w: number, h: number) => {
    const ns = Object.values(itemsRef.current).filter((i) => i.kind === "note");
    const hit = (x: number, y: number) => ns.some((n) => x < n.x + n.w + 8 && x + w + 8 > n.x && y < n.y + n.h + 8 && y + h + 8 > n.y);
    const sx = w + 16, sy = h + 16;
    for (let ring = 0; ring < 6; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const x = x0 + dx * sx, y = y0 + dy * sy;
          if (!hit(x, y)) return { x, y };
        }
      }
    }
    return { x: x0 + 24, y: y0 + 24 };
  };

  const addItem = (kind: "note" | "section", at?: { x: number; y: number }, text = "") => {
    if (Object.keys(itemsRef.current).length >= BOARD_MAX_ITEMS) {
      setNotice(`一塊白板最多 ${BOARD_MAX_ITEMS} 張`);
      return null;
    }
    const w = kind === "note" ? NOTE_W : 560;
    const h = kind === "note" ? NOTE_H : 380;
    const c = at ?? centerWorld();
    // 從畫面中央新增時，找附近沒有被便利貼蓋住的位置，避免疊在一起
    const pos = at || kind === "section" ? { x: c.x - w / 2, y: c.y - h / 2 } : freeSpot(c.x - w / 2, c.y - h / 2, w, h);
    const it: BoardItem = {
      id: crypto.randomUUID(), kind,
      x: r(pos.x), y: r(pos.y), w, h,
      z: kind === "section" ? 0 : maxZ() + 1,
      color: kind === "section" ? "white" : color,
      text: kind === "section" ? text || "新分區" : text,
      author_id: me, updated_by: me, rev: 0,
    };
    setItems((p) => ({ ...p, [it.id]: it }));
    push({ op: "add", id: it.id, kind, x: it.x, y: it.y, w, h, z: it.z, color: it.color, text: it.text });
    return it;
  };

  const startEdit = (it: BoardItem) => {
    if (!canEdit(it)) { setNotice(it.kind === "note" ? "只有貼的人或小幫手老師可以改字" : "只有建立的人或小幫手老師可以改標題"); return; }
    setSelected(it.id);
    setEditing(it.id);
    setDraft(it.text);
  };

  const finishEdit = () => {
    const id = editingRef.current;
    if (!id) return;
    const it = itemsRef.current[id];
    setEditing(null);
    if (!it) return;
    const max = it.kind === "section" ? SECTION_MAX : NOTE_MAX;
    const text = draft.slice(0, max);
    if (text !== it.text) {
      setItems((p) => (p[id] ? { ...p, [id]: { ...p[id], text } } : p));
      push({ op: "edit", id, text });
    }
  };

  const setItemColor = (it: BoardItem, c: BoardColor) => {
    if (!canEdit(it)) return;
    setItems((p) => ({ ...p, [it.id]: { ...p[it.id], color: c } }));
    push({ op: "edit", id: it.id, color: c });
  };

  const remove = (it: BoardItem) => {
    setItems((p) => {
      const n = { ...p };
      delete n[it.id];
      for (const a of Object.values(n)) if (a.kind === "arrow" && (a.from_id === it.id || a.to_id === it.id)) delete n[a.id];
      return n;
    });
    queue.current = queue.current.filter((o) => o.id !== it.id || o.op === "add");
    push({ op: "del", id: it.id });
    setSelected(null);
    if (editingRef.current === it.id) setEditing(null);
  };

  const addArrow = (from: string, to: string) => {
    const all = itemsRef.current;
    if (from === to || !all[from] || !all[to]) return;
    if (Object.values(all).some((a) => a.kind === "arrow" && a.from_id === from && a.to_id === to)) { setNotice("這兩張已經連過了"); return; }
    const a: BoardItem = { id: crypto.randomUUID(), kind: "arrow", from_id: from, to_id: to, x: 0, y: 0, w: 80, h: 60, z: 0, color: "white", text: "", author_id: me, updated_by: me, rev: 0 };
    setItems((p) => ({ ...p, [a.id]: a }));
    push({ op: "add", id: a.id, kind: "arrow", from_id: from, to_id: to });
    setSelected(to);
  };

  // AI 分群：在白板右邊為每一群建立分區框，把便利貼排進去（兩欄，每群最多 3 張一排）
  const arrange = (groups: BoardAi["groups"]) => {
    const cur = Object.values(itemsRef.current).filter((i) => i.kind !== "arrow");
    const baseX = cur.length ? Math.max(...cur.map((i) => i.x + i.w)) + 120 : 0;
    const baseY = cur.length ? Math.min(...cur.map((i) => i.y)) : 0;
    const colY = [baseY, baseY];
    const colW = (3 * NOTE_W + 2 * 16 + 48) + 40;
    let z = maxZ();
    const changes: Record<string, BoardItem> = {};
    groups.forEach((g, gi) => {
      const ns = g.noteIds.map((id) => itemsRef.current[id]).filter((n): n is BoardItem => !!n && n.kind === "note");
      if (!ns.length) return;
      const cellW = Math.min(320, Math.max(...ns.map((n) => n.w))), cellH = Math.min(320, Math.max(...ns.map((n) => n.h)));
      const cols = Math.min(3, ns.length), rows = Math.ceil(ns.length / cols);
      const w = 48 + cols * cellW + (cols - 1) * 16, h = 72 + rows * cellH + (rows - 1) * 16;
      const c = gi % 2 === 0 ? 0 : 1;
      const x = baseX + c * Math.max(colW, w + 40), y = colY[c];
      colY[c] += h + 40;
      const sec: BoardItem = { id: crypto.randomUUID(), kind: "section", x: r(x), y: r(y), w: r(w), h: r(h), z: 0, color: "white", text: g.title.slice(0, SECTION_MAX), author_id: me, updated_by: me, rev: 0 };
      changes[sec.id] = sec;
      push({ op: "add", id: sec.id, kind: "section", x: sec.x, y: sec.y, w: sec.w, h: sec.h, z: 0, color: "white", text: sec.text });
      ns.forEach((n, i) => {
        const nx = r(x + 24 + (i % cols) * (cellW + 16)), ny = r(y + 56 + Math.floor(i / cols) * (cellH + 16));
        z += 1;
        changes[n.id] = { ...n, x: nx, y: ny, z };
        push({ op: "move", id: n.id, x: nx, y: ny, z });
      });
    });
    setItems((p) => ({ ...p, ...changes }));
    if (list) setList(false);
    fitted.current = false;
    setTimeout(fitAll, 50);
  };

  const runAi = async () => {
    setAiBusy(true);
    setNotice("");
    // 先把還沒送出的變更送出，AI 才會看到最新的白板
    if (editingRef.current) finishEdit();
    await new Promise((ok) => setTimeout(ok, 400));
    const r = await organizeBoard(meetingId);
    setAiBusy(false);
    if (r.ok && r.ai) setAi(r.ai); else setNotice(r.message);
  };

  // ---------- 拖動、平移、縮放 ----------
  const toWorld = (clientX: number, clientY: number) => {
    const vp = vpRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - vp.left - v.x) / v.s, y: (clientY - vp.top - v.y) / v.s };
  };

  const zoomAt = (s: number, cx: number, cy: number) => {
    setView((v) => {
      const ns = clampS(s);
      return { s: ns, x: cx - ((cx - v.x) * ns) / v.s, y: cy - ((cy - v.y) * ns) / v.s };
    });
  };

  const zoomBy = (f: number) => {
    const vp = vpRef.current?.getBoundingClientRect();
    zoomAt(viewRef.current.s * f, (vp?.width ?? 800) / 2, (vp?.height ?? 500) / 2);
  };

  const fitAll = useCallback(() => {
    const all = Object.values(itemsRef.current).filter((i) => i.kind !== "arrow");
    const vp = vpRef.current?.getBoundingClientRect();
    if (!vp) return;
    if (!all.length) { setView({ x: 40, y: 40, s: 1 }); return; }
    const x0 = Math.min(...all.map((i) => i.x)), y0 = Math.min(...all.map((i) => i.y));
    const x1 = Math.max(...all.map((i) => i.x + i.w)), y1 = Math.max(...all.map((i) => i.y + i.h));
    const s = clampS(Math.min((vp.width - 48) / (x1 - x0), (vp.height - 48) / (y1 - y0), 1.2));
    setView({ s, x: (vp.width - (x1 - x0) * s) / 2 - x0 * s, y: (vp.height - (y1 - y0) * s) / 2 - y0 * s });
  }, []);

  // 第一次載入後，把所有東西放進畫面
  const fitted = useRef(false);
  useEffect(() => {
    if (loaded && !fitted.current && !list) { fitted.current = true; requestAnimationFrame(fitAll); }
  }, [loaded, list, full, fitAll]);

  // 滑鼠滾輪：平移；按住 Ctrl（或觸控板捏合）：縮放
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(viewRef.current.s * Math.exp(-e.deltaY * 0.0025), e.clientX - rect.left, e.clientY - rect.top);
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [list]);

  const onItemPointerDown = (e: React.PointerEvent, it: BoardItem, mode: "move" | "resize") => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if ((e.target as HTMLElement).closest("textarea,button,input")) return;
    e.stopPropagation();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (editing && editing !== it.id) finishEdit();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (mode === "resize") {
      drag.current = { mode: "resize", pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, id: it.id, ow: it.w, oh: it.h };
      return;
    }
    // 拖分區框時，裡面的便利貼一起移動
    const all = itemsRef.current;
    const ids = it.kind === "section"
      ? [it.id, ...Object.values(all).filter((n) => n.kind === "note" && inside(n, it)).map((n) => n.id)]
      : [it.id];
    drag.current = {
      mode: "move", pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, mainId: it.id,
      targets: ids.map((id) => ({ id, ox: all[id].x, oy: all[id].y })),
    };
  };

  const onBgPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if ((e.target as HTMLElement).closest(HANDLES)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (pointers.current.size === 2) {
      // 兩指捏合縮放
      const [a, b] = [...pointers.current.values()];
      const rect = vpRef.current!.getBoundingClientRect();
      const v = viewRef.current;
      pinch.current = {
        d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: v.s,
        cx: (a.x + b.x) / 2 - rect.left, cy: (a.y + b.y) / 2 - rect.top, vx: v.x, vy: v.y,
      };
      drag.current = null;
      return;
    }
    if (editing) finishEdit();
    const w = toWorld(e.clientX, e.clientY);
    drag.current = { mode: "pan", pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, ox: viewRef.current.x, oy: viewRef.current.y, moved: false, wx: w.x, wy: w.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pinch.current;
    if (p && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const ns = clampS((p.s * Math.hypot(a.x - b.x, a.y - b.y)) / p.d);
      setView({ s: ns, x: p.cx - ((p.cx - p.vx) * ns) / p.s, y: p.cy - ((p.cy - p.vy) * ns) / p.s });
      return;
    }
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (d.mode === "pan") {
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
      return;
    }
    const s = viewRef.current.s;
    if (d.mode === "resize") {
      const it = itemsRef.current[d.id];
      if (!it) return;
      const minW = it.kind === "note" ? 120 : 200, minH = it.kind === "note" ? 80 : 140;
      setItems((p) => ({ ...p, [d.id]: { ...p[d.id], w: Math.max(minW, r(d.ow + dx / s)), h: Math.max(minH, r(d.oh + dy / s)) } }));
      return;
    }
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    if (!d.moved) {
      d.moved = true;
      // 拖起來的便利貼放到最上層
      const main = itemsRef.current[d.mainId];
      if (main?.kind === "note") {
        const z = maxZ() + 1;
        setItems((p) => ({ ...p, [d.mainId]: { ...p[d.mainId], z } }));
      }
    }
    setItems((p) => {
      const n = { ...p };
      for (const t of d.targets) if (n[t.id]) n[t.id] = { ...n[t.id], x: r(t.ox + dx / s), y: r(t.oy + dy / s) };
      return n;
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      return;
    }
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (d.mode === "pan") {
      if (!d.moved) { setSelected(null); setConnectFrom(null); }
      return;
    }
    const all = itemsRef.current;
    if (d.mode === "resize") {
      const it = all[d.id];
      if (it) push({ op: "move", id: it.id, x: it.x, y: it.y, w: it.w, h: it.h });
      return;
    }
    if (!d.moved) {
      if (connectFrom && connectFrom !== d.mainId) { addArrow(connectFrom, d.mainId); setConnectFrom(null); return; }
      setSelected(d.mainId);
      return;
    }
    setSelected(d.mainId);
    for (const t of d.targets) {
      const it = all[t.id];
      if (it) push({ op: "move", id: it.id, x: it.x, y: it.y, z: it.z });
    }
  };

  // 點兩下空白處：在那裡貼一張便利貼
  const onBgDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(HANDLES)) return;
    const w = toWorld(e.clientX, e.clientY);
    const it = addItem("note", w);
    if (it) { setSelected(it.id); setEditing(it.id); setDraft(""); }
  };

  // ---------- 畫面 ----------
  const all = Object.values(items).filter((i) => i.kind !== "arrow");
  const arrows = Object.values(items).filter((i) => i.kind === "arrow" && i.from_id && i.to_id && items[i.from_id] && items[i.to_id]);
  const sections = all.filter((i) => i.kind === "section").sort((a, b) => a.z - b.z || a.rev - b.rev);
  const notes = all.filter((i) => i.kind === "note").sort((a, b) => a.z - b.z || a.rev - b.rev);
  const sel = selected ? items[selected] : null;
  const editors = new Map(presence.filter((p) => p.editing && p.teacher_id !== me).map((p) => [p.editing!, p.teacher_id]));
  const online = presence.map((p) => p.teacher_id);
  if (!online.includes(me)) online.unshift(me);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  // 被別人刪掉的項目，取消選取
  useEffect(() => {
    if (selected && !items[selected]) setSelected(null);
  }, [items, selected]);

  const newNoteHere = () => {
    const it = addItem("note");
    if (it) { setSelected(it.id); setEditing(it.id); setDraft(""); }
  };
  const newSection = () => {
    const it = addItem("section");
    if (it) { setSelected(it.id); setEditing(it.id); setDraft(it.text); }
  };

  const textArea = (it: BoardItem) => (
    <textarea
      className="bd-input"
      autoFocus
      value={draft}
      maxLength={it.kind === "section" ? SECTION_MAX : NOTE_MAX}
      aria-label={it.kind === "section" ? "分區標題" : "便利貼內容"}
      placeholder={it.kind === "section" ? "分區標題" : "寫下想法…（Ctrl＋Enter 完成）"}
      onFocus={(e) => { const n = e.currentTarget.value.length; e.currentTarget.setSelectionRange(n, n); }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={finishEdit}
      onKeyDown={(e) => {
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey || it.kind === "section"))) {
          e.preventDefault();
          finishEdit();
        }
      }}
    />
  );

  return (
    <div className={`bd${full ? " full" : ""}`} onKeyDown={(e) => { if (e.key === "Escape" && full && !editing) setFull(false); }}>
      <div className="bd-bar">
        <div className="bd-tools">
          <span className="bd-swatches" role="group" aria-label="新便利貼的顏色">
            {BOARD_COLORS.map((c) => (
              <button key={c.value} type="button" className={`bd-sw${color === c.value ? " on" : ""}`}
                style={{ background: c.bg, borderColor: c.line }} aria-label={`${c.label}色`} aria-pressed={color === c.value}
                onClick={() => setColor(c.value)} />
            ))}
          </span>
          <button type="button" className="btn btn-sm primary" onClick={newNoteHere}>＋ 便利貼</button>
          <button type="button" className="btn btn-sm" onClick={newSection}>＋ 分區框</button>
          <button type="button" className="btn btn-sm" disabled={aiBusy} onClick={() => void runAi()}>{aiBusy ? "AI 整理中…（約 10–30 秒）" : "✨ AI 整理"}</button>
          {!list && (
            <span className="bd-zoom">
              <button type="button" className="btn btn-sm" aria-label="縮小" onClick={() => zoomBy(1 / 1.25)}>−</button>
              <button type="button" className="adm-link" onClick={() => setView((v) => ({ ...v, s: 1 }))} aria-label="縮放比例，按一下回到 100%">{Math.round(view.s * 100)}%</button>
              <button type="button" className="btn btn-sm" aria-label="放大" onClick={() => zoomBy(1.25)}>＋</button>
              <button type="button" className="btn btn-sm" onClick={fitAll}>全部看到</button>
            </span>
          )}
          <button type="button" className="btn btn-sm" aria-pressed={full} onClick={() => { setFull((x) => !x); if (!full) setList(false); fitted.current = false; }}>
            {full ? "↙ 離開全螢幕" : "⛶ 全螢幕"}
          </button>
          <button type="button" className="btn btn-sm" aria-pressed={list} onClick={() => { setList((x) => !x); fitted.current = false; }}>
            {list ? "🧩 白板模式" : "📋 條列模式"}
          </button>
        </div>
        <div className="bd-meta">
          <span className="bd-online" aria-label="正在看這塊白板的老師">
            {online.map((id) => <span key={id} className="bd-who">{nameOf(id)}{id === me ? "（我）" : ""}</span>)}
          </span>
          <span className={`bd-status ${status}`} role="status">
            {status === "ok" ? "已同步" : status === "sync" ? "同步中…" : errText || "連線中斷，稍後自動重試"}
          </span>
        </div>
        {sel && !list && (
          <div className="bd-selbar">
            <span className="muted">{sel.kind === "note" ? `便利貼・${nameOf(sel.author_id)}` : sel.kind === "arrow" ? `箭頭・${nameOf(sel.author_id)}` : `分區框「${sel.text}」`}</span>
            {sel.kind !== "arrow" && (
              <button type="button" className="adm-link" aria-pressed={connectFrom === sel.id}
                onClick={() => { setConnectFrom(connectFrom === sel.id ? null : sel.id); }}>
                {connectFrom === sel.id ? "取消連線" : "→ 連線"}
              </button>
            )}
            {sel.kind === "arrow" ? (canEdit(sel) ? (
              <ConfirmButton label="刪除箭頭" message="刪除這個箭頭？" confirmLabel="刪除" onConfirm={() => remove(sel)} />
            ) : <small className="muted">箭頭限畫的人或小幫手老師刪除</small>) : canEdit(sel) ? (
              <>
                {sel.kind === "note" && BOARD_COLORS.map((c) => (
                  <button key={c.value} type="button" className={`bd-sw${sel.color === c.value ? " on" : ""}`}
                    style={{ background: c.bg, borderColor: c.line }} aria-label={`改成${c.label}色`}
                    onClick={() => setItemColor(sel, c.value)} />
                ))}
                <button type="button" className="adm-link" onClick={() => startEdit(sel)}>{sel.kind === "note" ? "改字" : "改標題"}</button>
                <ConfirmButton label="刪除" message={sel.kind === "note" ? "刪除這張便利貼？" : "刪除這個分區框？裡面的便利貼會留著。"}
                  confirmLabel="刪除" onConfirm={() => remove(sel)} />
              </>
            ) : (
              <small className="muted">可以拖動；改字、刪除限{sel.kind === "note" ? "貼的人" : "建立的人"}或小幫手老師</small>
            )}
          </div>
        )}
        {connectFrom && <p className="notice ok bd-notice" role="status">連線中：點另一張便利貼或分區框，就會畫出箭頭（點空白處取消）</p>}
        {notice && <p className="notice err bd-notice" role="status">{notice}</p>}
      </div>

      {ai && (
        <BoardAiPanel ai={ai} meetingId={meetingId} planId={planId} canDecide={canDecide} teachers={activeTeachers ?? teachers}
          textOf={(id) => itemsRef.current[id]?.text ?? ""} onArrange={arrange} onClose={() => setAi(null)} />
      )}
      {!loaded && status !== "err" && <p className="muted">白板載入中…</p>}

      {list ? (
        <ListView
          items={items} sections={sections} notes={notes} me={me} nameOf={nameOf} canEdit={canEdit}
          editing={editing} draft={draft} textArea={textArea} startEdit={startEdit} remove={remove}
          editors={editors}
          addNote={(sec) => {
            let at: { x: number; y: number } | undefined;
            if (sec) {
              const n = notes.filter((x) => inside(x, sec)).length;
              at = { x: sec.x + 24 + NOTE_W / 2 + (n % 3) * (NOTE_W + 16), y: sec.y + 56 + NOTE_H / 2 + Math.floor(n / 3) * (NOTE_H + 16) };
            }
            else {
              // 未分區：放在所有分區框的右邊，避免剛好落進某個分區
              const right = Math.max(0, ...sections.map((x) => x.x + x.w)) + 40;
              const top = Math.min(0, ...sections.map((x) => x.y));
              const n = notes.filter((x) => !sections.some((sc) => inside(x, sc))).length;
              at = { x: right + NOTE_W / 2 + (n % 2) * (NOTE_W + 16), y: top + NOTE_H / 2 + Math.floor(n / 2) * (NOTE_H + 16) };
            }
            const it = addItem("note", at);
            if (it) { setEditing(it.id); setDraft(""); }
          }}
        />
      ) : (
        <div
          ref={vpRef}
          className="bd-vp"
          onPointerDown={onBgPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onBgDoubleClick}
          aria-label={`${title} 的討論白板。點兩下空白處新增便利貼，拖動空白處移動畫面。`}
        >
          {loaded && all.length === 0 && (
            <p className="bd-empty">按「＋ 便利貼」或在空白處點兩下，開始寫下想法。</p>
          )}
          <div className="bd-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}>
            {sections.map((it) => (
              <div key={it.id} className={`bd-item bd-sec${selected === it.id ? " sel" : ""}${connectFrom === it.id ? " from" : ""}`}
                style={{ left: it.x, top: it.y, width: it.w, height: it.h }}>
                <div className="bd-sec-head" onPointerDown={(e) => onItemPointerDown(e, it, "move")}
                  onDoubleClick={(e) => { e.stopPropagation(); startEdit(it); }}>
                  {editing === it.id ? textArea(it) : <strong>{it.text || "（未命名分區）"}</strong>}
                  {editors.has(it.id) && <span className="bd-editor">✏️ {nameOf(editors.get(it.id)!)}</span>}
                </div>
                {canResize(it) && (
                  <span className="bd-resize" aria-hidden onPointerDown={(e) => onItemPointerDown(e, it, "resize")} />
                )}
              </div>
            ))}
            <svg className="bd-arrows" width="1" height="1" aria-hidden>
              <defs>
                <marker id="bd-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#5f6368" />
                </marker>
                <marker id="bd-head-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#5098d2" />
                </marker>
              </defs>
              {arrows.map((a) => {
                const A = items[a.from_id!], B = items[a.to_id!];
                const p1 = edgePoint(A, B.x + B.w / 2, B.y + B.h / 2);
                const p2 = edgePoint(B, A.x + A.w / 2, A.y + A.h / 2);
                const on = selected === a.id;
                return (
                  <g key={a.id} className="bd-arrow" onPointerDown={(e) => { e.stopPropagation(); setSelected(a.id); setConnectFrom(null); }}>
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={16} />
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={on ? "#5098d2" : "#5f6368"} strokeWidth={on ? 3 : 2}
                      markerEnd={`url(#${on ? "bd-head-sel" : "bd-head"})`} />
                  </g>
                );
              })}
            </svg>
            {notes.map((it) => {
              const c = colorOf(it.color);
              return (
                <div key={it.id} className={`bd-item bd-note${selected === it.id ? " sel" : ""}${editors.has(it.id) ? " busy" : ""}${connectFrom === it.id ? " from" : ""}`}
                  style={{ left: it.x, top: it.y, width: it.w, height: it.h, zIndex: it.z + 1, background: c.bg, borderColor: c.line }}
                  onPointerDown={(e) => onItemPointerDown(e, it, "move")}
                  onDoubleClick={(e) => { e.stopPropagation(); startEdit(it); }}>
                  {editing === it.id ? textArea(it) : <p className="bd-text">{it.text || <span className="muted">（空白）</span>}</p>}
                  <span className="bd-author">
                    {editors.has(it.id) ? `✏️ ${nameOf(editors.get(it.id)!)} 編輯中` : nameOf(it.author_id)}
                  </span>
                  {canResize(it) && selected === it.id && (
                    <span className="bd-resize" aria-hidden onPointerDown={(e) => onItemPointerDown(e, it, "resize")} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="hint bd-hint">
        {list
          ? "條列模式依分區列出便利貼，適合手機。切回白板模式可以拖拉排列。"
          : "點兩下空白處新增便利貼；拖動便利貼排列，拖分區框的標題會連裡面的便利貼一起移動；拖空白處移動畫面，Ctrl＋滾輪或兩指縮放。"}
      </p>
    </div>
  );
}

// 條列模式：依分區列出（便利貼的中心點在哪個分區框裡就算哪一區）
function ListView({
  items, sections, notes, nameOf, canEdit, editing, textArea, startEdit, remove, addNote, editors,
}: {
  items: Record<string, BoardItem>; sections: BoardItem[]; notes: BoardItem[]; me: string;
  nameOf: (id: string | null) => string; canEdit: (it: BoardItem) => boolean;
  editing: string | null; draft: string; textArea: (it: BoardItem) => React.ReactNode;
  startEdit: (it: BoardItem) => void; remove: (it: BoardItem) => void;
  addNote: (sec: BoardItem | null) => void; editors: Map<string, string>;
}) {
  void items;
  const used = new Set<string>();
  // 上層（後畫）的分區優先
  const groups = [...sections].reverse().map((s) => {
    const ns = notes.filter((n) => !used.has(n.id) && inside(n, s));
    ns.forEach((n) => used.add(n.id));
    return { sec: s as BoardItem | null, notes: ns };
  }).reverse();
  groups.push({ sec: null, notes: notes.filter((n) => !used.has(n.id)) });
  const sortPos = (a: BoardItem, b: BoardItem) => a.y - b.y || a.x - b.x;

  return (
    <div className="bd-list">
      {groups.map((g) => (
        <section key={g.sec?.id ?? "none"} className="bd-group">
          <h3>
            {g.sec ? (editing === g.sec.id ? textArea(g.sec) : g.sec.text || "（未命名分區）") : sections.length ? "未分區" : "便利貼"}
            <small className="muted">（{g.notes.length}）</small>
            {g.sec && canEdit(g.sec) && editing !== g.sec.id && (
              <button type="button" className="adm-link" onClick={() => startEdit(g.sec!)}>改標題</button>
            )}
          </h3>
          <ul>
            {[...g.notes].sort(sortPos).map((n) => {
              const c = colorOf(n.color);
              return (
                <li key={n.id} className="bd-li" style={{ borderLeftColor: c.line, background: c.bg }}>
                  {editing === n.id ? textArea(n) : <p className="bd-text">{n.text || <span className="muted">（空白）</span>}</p>}
                  <div className="bd-li-foot">
                    <small className="muted">{editors.has(n.id) ? `✏️ ${nameOf(editors.get(n.id)!)} 編輯中` : nameOf(n.author_id)}</small>
                    {canEdit(n) && editing !== n.id && (
                      <>
                        <button type="button" className="adm-link" onClick={() => startEdit(n)}>改字</button>
                        <ConfirmButton label="刪除" message="刪除這張便利貼？" confirmLabel="刪除" onConfirm={() => remove(n)} />
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn btn-sm" onClick={() => addNote(g.sec)}>＋ 在這裡新增</button>
        </section>
      ))}
    </div>
  );
}

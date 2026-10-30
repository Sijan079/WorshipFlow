"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { UsageBucket } from "./usage-buckets";

const HEIGHT = 190;
const PAD = { top: 12, right: 6, bottom: 24, left: 36 };
const GLIDE_MS = 420;
// How far apart in time the first and last bar start moving, so the change sweeps across the row.
const SWEEP_MS = 260;

// Things that move glide. The app turns animation off for people who ask for reduced motion.
const GLIDE = `x ${GLIDE_MS}ms ease, y ${GLIDE_MS}ms ease, width ${GLIDE_MS}ms ease, height ${GLIDE_MS}ms ease, opacity ${GLIDE_MS}ms ease, transform ${GLIDE_MS}ms ease`;

// A round top for the axis with a whole-number middle, so the labels never need decimals.
function niceMax(value: number) {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 4, 10].find((candidate) => candidate * power >= value) ?? 10;
  return step * power;
}

type Geom = { x: number; w: number; h: number; stub: number; slotX: number; slotW: number };
type Item = { key: string; geom: Geom; opacity: number; delay: number };
// A label under the bars (12am, Mon, 15). It stays where it will end up and only rises and fades, so it never
// slides sideways with the bars. `id` includes the view, so each view has its own set of labels.
type Label = { id: string; text: string; x: number; shown: boolean; delay: number };
type Last = { layout: Map<string, Geom>; buckets: UsageBucket[]; level: number; width: number; labels: Label[] };

const barWidth = (slot: number) => Math.min(slot * 0.62, 28);

function layoutOf(buckets: UsageBucket[], width: number, top: number) {
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerW / buckets.length;
  const w = barWidth(slot);
  return new Map<string, Geom>(buckets.map((bucket, index) => {
    const slotX = PAD.left + index * slot;
    const h = bucket.future || bucket.value === null ? 0 : Math.max(bucket.value > 0 ? 2 : 0, (bucket.value / top) * innerH);
    return [bucket.key, { x: slotX + (slot - w) / 2, w, h, stub: bucket.future ? 22 : 0, slotX, slotW: slot }];
  }));
}

// Where a bar sits when it is squeezed into the slot of the bar that holds it (an hour inside its day), the
// n-th of `count` children. This is what makes a day open out into its hours, or its hours fold back.
function inside(parent: Geom, index: number, count: number, h: number): Geom {
  const slotW = parent.slotW / count;
  const w = barWidth(slotW);
  const slotX = parent.slotX + index * slotW;
  return { x: slotX + (slotW - w) / 2, w, h, stub: 0, slotX, slotW };
}

function siblingPosition(buckets: UsageBucket[], bucket: UsageBucket) {
  const family = buckets.filter((candidate) => candidate.parent !== undefined && candidate.parent === bucket.parent);
  return { index: family.findIndex((candidate) => candidate.key === bucket.key), count: family.length };
}

// One bar for each bucket (an hour or a day). A bucket still to come is hatched, and one with no reading is
// empty. One series, so the heading names it and there is no legend. The drawing is sized to the card in real
// pixels, so the numbers stay small instead of growing with a wide card.
//
// Changing the view zooms. A bar is the same bar in every view that shows it (a day in the week is that day in
// the month), so going from the month to the week, the week's days stay and open out to full width from their
// place in the month while the other days fade; going back, they fold into that place. Going to a finer view
// sweeps left to right; going to a coarser one sweeps right to left. An hour is held by its day.
export default function UsageBarChart({ title, range, buckets, level = 0, unit, format, ariaSummary }: {
  title?: string; range: string; buckets: UsageBucket[]; level?: number; unit: string; format: (value: number) => string; ariaSummary: string;
}) {
  const hatchId = useId();
  const holder = useRef<HTMLDivElement>(null);
  const last = useRef<Last | null>(null);
  const [width, setWidth] = useState(640);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [instant, setInstant] = useState(true);
  const [labels, setLabels] = useState<Label[]>([]);

  useEffect(() => {
    const node = holder.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const count = buckets.length;
  const top = niceMax(Math.max(0, ...buckets.map((bucket) => bucket.value ?? 0)));
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerW / count;
  const y = (value: number) => PAD.top + innerH - (value / top) * innerH;
  const current = activeKey === null ? null : buckets.find((bucket) => bucket.key === activeKey) ?? null;
  const currentIndex = current ? buckets.indexOf(current) : -1;

  useEffect(() => {
    const next = layoutOf(buckets, width, top);
    const before = last.current;
    const labelsNow = (shown: boolean, delayOf: (rank: number) => number): Label[] => buckets.flatMap((bucket, rank) => bucket.axis ? [{ id: `${level}|${bucket.key}`, text: bucket.axis, x: next.get(bucket.key)!.x + next.get(bucket.key)!.w / 2, shown, delay: delayOf(rank) }] : []);
    last.current = { layout: next, buckets, level, width, labels: labelsNow(true, () => 0) };
    const frames: number[] = [];
    let cleanup: number | undefined;
    const rest = (): Item[] => buckets.map((bucket) => ({ key: bucket.key, geom: next.get(bucket.key)!, opacity: 1, delay: 0 }));

    if (!before || before.width !== width) {
      // The first drawing and a resize happen at once, not as a zoom.
      frames.push(requestAnimationFrame(() => { setInstant(true); setItems(rest()); setLabels(labelsNow(true, () => 0)); }));
    } else {
      const zoomIn = level < before.level;
      const zoomOut = level > before.level;
      const sweep = (rank: number, total: number) => (zoomIn || zoomOut) && total > 1 ? (zoomIn ? rank / (total - 1) : 1 - rank / (total - 1)) * SWEEP_MS : 0;
      const newKeys = new Set(buckets.map((bucket) => bucket.key));
      const arriving = new Map<string, Geom>();
      const staying: Item[] = [];
      const leaving: Item[] = [];
      const leavingTo = new Map<string, Geom>();
      buckets.forEach((bucket, rank) => {
        const target = next.get(bucket.key)!;
        const from = before.layout.get(bucket.key);
        if (from) { staying.push({ key: bucket.key, geom: from, opacity: 1, delay: sweep(rank, count) }); return; }
        const holderGeom = bucket.parent ? before.layout.get(bucket.parent) : undefined;
        const place = holderGeom ? siblingPosition(buckets, bucket) : null;
        arriving.set(bucket.key, holderGeom && place ? inside(holderGeom, place.index, place.count, target.h) : { ...target, h: 0, stub: 0 });
        staying.push({ key: bucket.key, geom: arriving.get(bucket.key)!, opacity: 0, delay: sweep(rank, count) });
      });
      before.buckets.forEach((bucket, rank) => {
        if (newKeys.has(bucket.key)) return;
        const from = before.layout.get(bucket.key)!;
        const holderGeom = bucket.parent ? next.get(bucket.parent) : undefined;
        const place = holderGeom ? siblingPosition(before.buckets, bucket) : null;
        leavingTo.set(bucket.key, holderGeom && place ? inside(holderGeom, place.index, place.count, from.h) : { ...from, h: 0, stub: 0 });
        leaving.push({ key: bucket.key, geom: from, opacity: 1, delay: sweep(rank, before.buckets.length) });
      });
      // Labels: the old view's drop away and fade, the new view's rise into place, each where it will stay.
      const oldLabels = level === before.level ? [] : before.labels;
      frames.push(requestAnimationFrame(() => {
        setInstant(false);
        setItems([...staying, ...leaving]);
        setLabels([...oldLabels.map((label) => ({ ...label, shown: true })), ...labelsNow(false, (rank) => sweep(rank, count))]);
        frames.push(requestAnimationFrame(() => {
          const settled = rest().map((item, rank) => ({ ...item, delay: staying[rank]?.delay ?? 0 }));
          setItems([...settled, ...leaving.map((item) => ({ ...item, geom: leavingTo.get(item.key)!, opacity: 0 }))]);
          setLabels([...oldLabels.map((label) => ({ ...label, shown: false })), ...labelsNow(true, (rank) => sweep(rank, count))]);
          cleanup = window.setTimeout(() => { setItems(settled); setLabels(labelsNow(true, () => 0)); }, GLIDE_MS + SWEEP_MS + 80);
        }));
      }));
    }
    return () => { frames.forEach((frame) => cancelAnimationFrame(frame)); if (cleanup !== undefined) window.clearTimeout(cleanup); };
  }, [buckets, width, top, level, count]);

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - box.left - PAD.left) / slot);
    setActiveKey(index >= 0 && index < count ? buckets[index].key : null);
  }

  const transition = (delay: number) => (instant ? "none" : GLIDE.split(", ").map((part) => `${part} ${delay}ms`).join(", "));

  return <figure className="mt-4">
    <div className="flex items-baseline justify-between gap-3">
      {title ? <figcaption className="text-sm font-semibold text-[var(--text-primary)]">{title}</figcaption> : <span />}
      <span className="text-sm text-[var(--text-secondary)]">{range}</span>
    </div>
    <div ref={holder} className="relative mt-2">
      <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} className="block touch-pan-y" role="img" aria-label={ariaSummary} onPointerMove={onMove} onPointerLeave={() => setActiveKey(null)}>
        <defs>
          <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--border-default)" strokeWidth={2} />
          </pattern>
        </defs>
        {[0, 0.5, 1].map((fraction) => <g key={fraction} style={{ transform: `translateY(${y(top * fraction)}px)`, transition: instant ? "none" : `transform ${GLIDE_MS}ms ease` }}>
          <line x1={PAD.left} x2={width - PAD.right} y1={0} y2={0} stroke="var(--border-default)" strokeWidth={1} strokeDasharray={fraction === 0 ? undefined : "3 4"} />
          <text x={PAD.left - 8} y={4} textAnchor="end" className="fill-[var(--text-muted)]" fontSize={12}>{format(top * fraction)}</text>
        </g>)}
        {items.map((item) => {
          const { geom } = item;
          const lit = activeKey === item.key ? 1 : 0.55;
          return <g key={item.key}>
            <rect rx={3} fill={`url(#${hatchId})`} style={{ x: geom.x, y: PAD.top + innerH - geom.stub, width: geom.w, height: geom.stub, opacity: geom.stub ? 0.8 * item.opacity : 0, transition: transition(item.delay) }} />
            <rect rx={3} fill="var(--action-secondary-accent-bg)" style={{ x: geom.x, y: PAD.top + innerH - geom.h, width: geom.w, height: geom.h, opacity: lit * item.opacity, transition: transition(item.delay) }} />
          </g>;
        })}
        {labels.map((label) => <g key={label.id} style={{ transform: `translateX(${label.x}px)` }}>
          <text y={HEIGHT - 6} textAnchor="middle" className="fill-[var(--text-muted)]" fontSize={12} style={{ transform: `translateY(${label.shown ? 0 : 10}px)`, opacity: label.shown ? 1 : 0, transition: instant ? "none" : `transform ${GLIDE_MS}ms ease ${label.delay}ms, opacity ${GLIDE_MS}ms ease ${label.delay}ms` }}>{label.text}</text>
        </g>)}
      </svg>
      {current ? <div
        className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--text-primary)] px-3 py-2 text-sm text-[var(--surface-panel)] shadow-[var(--elevation-raised)]"
        style={{ left: Math.min(width - 90, Math.max(90, PAD.left + (currentIndex + 0.5) * slot)) }}
      >
        <div><span className="opacity-70">When:</span> <strong className="font-semibold">{current.tooltip}</strong></div>
        <div><span className="opacity-70">{unit}:</span> <strong className="font-semibold tabular-nums">{current.future ? "not yet" : current.value === null ? "no reading" : current.text ?? format(current.value)}</strong></div>
      </div> : null}
    </div>
  </figure>;
}

"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Clock } from "lucide-react";
import { Popover } from "radix-ui";
import { buildTime, formatTime, itemIndexFromScroll, parseTime, scrollForIndex, type ClockTime } from "@/lib/time-of-day";
import { cn } from "@/lib/utils";
import { usePopoverScrollGuard } from "@/components/ui/use-popover-scroll-guard";

// What a new time starts from when nothing has been chosen yet.
const FRESH: ClockTime = { hour: 9, minute: 0, period: "AM" };
const ROW = 44; // height of one row, in px
const PAD = ROW * 2; // space above the first row and below the last, so each can reach the middle band
const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const PERIODS: Array<"AM" | "PM"> = ["AM", "PM"];

type ProductionTimePickerProps = {
  /** A 24-hour time, "18:00", or "" for none. This is the same value a time input used to hold. */
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  ariaLabel?: string;
  className?: string;
  labelClassName?: string;
  triggerClassName?: string;
  placeholder?: string;
};

// One wheel: a column of rows that scrolls up and down past a fixed band. Scroll it with a finger, a mouse
// wheel or a touchpad, drag it with the mouse, tap a row, or use the arrow keys. The row in the band is the
// choice, and it applies as the wheel turns.
function WheelColumn<T extends string | number>({ label, items, value, onChange, format = String, className }: {
  label: string;
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
  format?: (item: T) => string;
  className?: string;
}) {
  const column = useRef<HTMLDivElement>(null);
  const turning = useRef(false); // the person is scrolling or dragging, so do not move the column under them
  const settleTimer = useRef<number | undefined>(undefined);
  const drag = useRef<{ y: number; top: number } | null>(null);
  const dragged = useRef(false);
  const index = Math.max(0, items.indexOf(value));
  const [inBand, setInBand] = useState(index);

  // Bring the column to the chosen row when it first shows, or when the value is changed from outside.
  useLayoutEffect(() => {
    const node = column.current;
    if (!node || turning.current) return;
    node.scrollTop = scrollForIndex(index, ROW);
    setInBand(index);
  }, [index]);

  function goTo(target: number, smooth = true) {
    const row = Math.min(items.length - 1, Math.max(0, target));
    column.current?.scrollTo({ top: scrollForIndex(row, ROW), behavior: smooth ? "smooth" : "auto" });
  }

  function handleScroll() {
    const node = column.current;
    if (!node) return;
    turning.current = true;
    const row = itemIndexFromScroll(node.scrollTop, ROW, items.length);
    setInBand(row);
    if (row !== index) onChange(items[row]);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => { turning.current = false; }, 150);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 };
    if (event.key in steps) goTo(inBand + steps[event.key]);
    else if (event.key === "Home") goTo(0);
    else if (event.key === "End") goTo(items.length - 1);
    else return;
    event.preventDefault();
  }

  return (
    <div className={cn("h-[220px]", className)}>
      <div
        ref={column}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => {
          // A finger and a touchpad scroll on their own; a mouse has to be dragged by hand.
          if (event.pointerType !== "mouse" || !column.current) return;
          drag.current = { y: event.clientY, top: column.current.scrollTop };
          dragged.current = false;
          column.current.setPointerCapture(event.pointerId);
          column.current.style.scrollSnapType = "none";
        }}
        onPointerMove={(event) => {
          if (!drag.current || !column.current) return;
          const distance = event.clientY - drag.current.y;
          if (Math.abs(distance) > 3) dragged.current = true;
          column.current.scrollTop = drag.current.top - distance;
        }}
        onPointerUp={() => {
          const node = column.current;
          if (!drag.current || !node) return;
          drag.current = null;
          node.style.scrollSnapType = "";
          goTo(itemIndexFromScroll(node.scrollTop, ROW, items.length));
        }}
        onPointerCancel={() => { drag.current = null; if (column.current) column.current.style.scrollSnapType = ""; }}
        className="h-full cursor-grab snap-y snap-mandatory overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,black_28%,black_72%,transparent)] [&::-webkit-scrollbar]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        style={{ scrollbarWidth: "none" }}
      >
        <div style={{ height: PAD }} aria-hidden="true" />
        {items.map((item, row) => (
          <div
            key={String(item)}
            role="option"
            aria-selected={row === index}
            onClick={() => { if (!dragged.current) goTo(row); }}
            className={cn("flex snap-center select-none items-center justify-center text-2xl tabular-nums", row === inBand ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)]")}
            style={{ height: ROW }}
          >
            {format(item)}
          </div>
        ))}
        <div style={{ height: PAD }} aria-hidden="true" />
      </div>
    </div>
  );
}

// Our own time picker, shaped like an alarm clock: three wheels (hour, minute, AM or PM) that you scroll or
// drag up and down until the time you want sits in the band. The same trigger and popup style as the date
// picker. Done only closes the popup; the choices apply as the wheels turn.
export function ProductionTimePicker({
  value,
  onValueChange,
  label,
  ariaLabel,
  className,
  labelClassName,
  triggerClassName,
  placeholder = "Select time",
}: ProductionTimePickerProps) {
  const labelId = useId();
  const scrollGuardRef = usePopoverScrollGuard();
  const [open, setOpen] = useState(false);
  const time = parseTime(value);
  const shown = time ?? FRESH;

  function choose(change: Partial<ClockTime>) {
    const next = { ...shown, ...change };
    onValueChange(buildTime(next.hour, next.minute, next.period));
  }

  return (
    <div className={className}>
      {label ? <span id={labelId} className={cn(labelClassName ?? "technical-label mb-1 block")}>{label}</span> : null}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={label ? undefined : ariaLabel}
            aria-labelledby={label ? labelId : undefined}
            className={cn(
              "inline-flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-panel-strong)]",
              triggerClassName,
            )}
          >
            <span className={time ? undefined : "text-[var(--text-muted)]"}>{time ? formatTime(value) : placeholder}</span>
            <Clock className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            ref={scrollGuardRef}
            side="bottom"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className="workspace-content-light z-[70] max-h-[var(--radix-popover-content-available-height)] w-[21rem] overflow-y-auto rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-panel-elevated)] p-0 text-[var(--text-primary)] shadow-[var(--elevation-raised)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          >
            <div className="border-b border-[var(--rule-default)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Choose time</p>
            </div>

            <div className="relative px-4 py-3">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-md bg-[var(--surface-panel-strong)]" style={{ height: ROW }} />
              <div className="relative flex items-stretch justify-center gap-1">
                <WheelColumn className="w-20" label="Hour" items={HOURS} value={shown.hour} onChange={(hour) => choose({ hour })} />
                <span aria-hidden="true" className="flex items-center text-2xl font-semibold text-[var(--text-secondary)]">:</span>
                <WheelColumn className="w-20" label="Minute" items={MINUTES} value={shown.minute} onChange={(minute) => choose({ minute })} format={(minute) => String(minute).padStart(2, "0")} />
                <WheelColumn className="w-20" label="AM or PM" items={PERIODS} value={shown.period} onChange={(period) => choose({ period })} />
              </div>
            </div>

            <div className="flex justify-end border-t border-[var(--rule-default)] px-4 py-3">
              <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-[var(--text-accent)] hover:text-[var(--action-secondary-accent-bg-hover)]">Done</button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

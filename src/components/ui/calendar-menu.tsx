"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { moveMenuIndex } from "@/lib/calendar-date";
import { cn } from "@/lib/utils";

type CalendarMenuOption = { value: number; label: string };

// A small themed dropdown for the calendar's month and year. It opens downward inside the
// calendar, shows about five rows and scrolls, and stands out with a stronger shadow.
// It is not portaled, so choosing an option never counts as clicking outside the calendar.
export function CalendarMenu({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: number;
  options: CalendarMenuOption[];
  onChange: (value: number) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selectedLabel = options[selectedIndex]?.label ?? "";

  function openMenu() {
    setHighlight(selectedIndex);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }

  // Close when the pointer goes down anywhere outside this menu, and let Escape close only the menu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      event.preventDefault();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  // A dialog locks page scrolling and ignores anything outside its own content, which would
  // swallow the wheel and touch here. Stopping the event at the list, before it reaches the
  // document, lets the list scroll normally.
  useEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    const keepScrollHere = (event: Event) => event.stopPropagation();
    list.addEventListener("wheel", keepScrollHere, { passive: true });
    list.addEventListener("touchmove", keepScrollHere, { passive: true });
    return () => {
      list.removeEventListener("wheel", keepScrollHere);
      list.removeEventListener("touchmove", keepScrollHere);
    };
  }, [open]);

  // Keep the highlighted row inside the visible part of the list.
  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[highlight] as HTMLElement | undefined;
    if (!open || !list || !item) return;
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
    }
  }, [open, highlight]);

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(highlight);
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setHighlight(moveMenuIndex(highlight, event.key, options.length));
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${selectedLabel}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className="inline-flex min-h-10 items-center justify-between gap-2 rounded-md bg-[var(--surface-panel-alt)] px-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-panel-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
      >
        {selectedLabel}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-full z-20 mt-1 max-h-44 min-w-full overflow-y-auto rounded-md border border-[var(--border-strong)] bg-[var(--surface-panel-elevated)] py-1 shadow-[var(--elevation-modal)]"
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={selected}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(index)}
                className={cn(
                  "flex min-h-9 cursor-pointer items-center justify-between gap-3 whitespace-nowrap px-3 text-sm text-[var(--text-primary)]",
                  index === highlight && "bg-[var(--surface-panel-strong)]",
                  selected && "font-semibold text-[var(--text-accent)]",
                )}
              >
                {option.label}
                {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

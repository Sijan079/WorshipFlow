"use client";

import { eventColorTokens } from "./event-colors";
import { fullDateLabel } from "./event-labels";
import { needsReview } from "./event-status";
import type { EventOccurrenceSummary } from "./event-types";
import type { MonthCell } from "./calendar";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// A short word before the title when a date is not simply scheduled.
export function datePrefix(item: EventOccurrenceSummary) {
  if (item.status === "CANCELLED") return "Cancelled · ";
  if (item.doneAt) return "Done · ";
  if (needsReview(item)) return "Needs review · ";
  return item.conflict ? "Overlap · " : "";
}

// The calendar's own shape while a month loads: the weekday header, a grid of days with their numbers, and
// pulsing placeholders where events will go. It matches the real grid cell for cell, so nothing shifts when
// the month arrives. Which days get placeholders is fixed by position, so it does not flicker.
export function EventMonthSkeleton({ cells }: { cells: MonthCell[] }) {
  return (
    <div role="status" aria-label="Loading events">
      <div className="ui-ledger-header grid grid-cols-7">{weekDays.map((day) => <span key={day} className="px-3 py-2.5">{day}</span>)}</div>
      <div className="grid grid-cols-7">
        {cells.map((cell, index) => (
          <div key={cell.date} className={`min-h-28 border-b border-r border-[var(--rule-default)] p-1.5 ${cell.inMonth ? "" : "bg-[var(--surface-panel-alt)]"}`}>
            <span className="mb-1 flex h-8 w-8 items-center justify-center text-xs font-semibold text-[var(--text-muted)]">{Number(cell.date.slice(-2))}</span>
            {index % 3 === 0 || index % 7 === 2 ? <div className="mb-1 h-6 w-full animate-pulse rounded bg-[var(--surface-panel-strong)]" /> : null}
            {index % 5 === 1 ? <div className="mb-1 h-6 w-3/4 animate-pulse rounded bg-[var(--surface-panel-strong)]" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// The month as a grid of days. The whole day selects the date; an event chip inside it selects that event.
export default function EventMonthGrid({ cells, byDate, selectedDate, onSelectDate, onSelectEvent }: {
  cells: MonthCell[];
  byDate: Map<string, EventOccurrenceSummary[]>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onSelectEvent: (date: string, id: string) => void;
}) {
  return (
    <>
      <div className="ui-ledger-header grid grid-cols-7">{weekDays.map((day) => <span key={day} className="px-3 py-2.5">{day}</span>)}</div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const dayItems = byDate.get(cell.date) ?? [];
          const selected = selectedDate === cell.date;
          return <div key={cell.date} onClick={() => onSelectDate(cell.date)} className={`min-h-28 cursor-pointer border-b border-r border-[var(--rule-default)] p-1.5 hover:bg-[var(--surface-panel-alt)] ${selected ? "bg-[var(--surface-panel-strong)]" : cell.inMonth ? "" : "bg-[var(--surface-panel-alt)]"}`}>
            <button type="button" onClick={() => onSelectDate(cell.date)} aria-label={fullDateLabel(cell.date)} aria-pressed={selected} className={`mb-1 flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] ${selected ? "bg-[var(--action-primary-bg)] text-[var(--action-primary-ink)]" : cell.inMonth ? "text-[var(--text-primary)] hover:bg-[var(--surface-panel-strong)]" : "text-[var(--text-muted)]"}`}>{Number(cell.date.slice(-2))}</button>
            {dayItems.slice(0, 3).map((item) => {
              // The event's own colour, except a cancelled date, which stays grey and struck through. An
              // overlap is still flagged by the word "Overlap" before the title, so colour keeps its meaning.
              const chip = eventColorTokens(item.color);
              const cancelled = item.status === "CANCELLED";
              return <button type="button" key={item.id} onClick={(event) => { event.stopPropagation(); onSelectEvent(cell.date, item.id); }} style={cancelled ? undefined : { background: chip.bg, color: chip.ink, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${chip.ink} 22%, transparent)` }} className={`mb-1 block w-full truncate rounded px-1.5 py-1 text-left text-xs font-medium focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] ${item.status === "CANCELLED" ? "bg-[var(--surface-panel-alt)] text-[var(--text-muted)] line-through" : ""}`}>{datePrefix(item)}{item.title}</button>;
            })}
            {dayItems.length > 3 ? <span className="px-1 text-xs text-[var(--text-muted)]">+{dayItems.length - 3} more</span> : null}
          </div>;
        })}
      </div>
    </>
  );
}

"use client";

import { useId, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "radix-ui";
import { formatCalendarDate, getCalendarDays, parseCalendarDate } from "@/lib/calendar-date";
import { cn } from "@/lib/utils";

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ProductionDatePickerProps = {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  ariaLabel?: string;
  className?: string;
  labelClassName?: string;
  triggerClassName?: string;
  allowClear?: boolean;
};

export function ProductionDatePicker({
  value,
  onValueChange,
  label,
  ariaLabel,
  className,
  labelClassName,
  triggerClassName,
  allowClear = false,
}: ProductionDatePickerProps) {
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const selectedDate = parseCalendarDate(value);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? new Date());
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setVisibleMonth(selectedDate ?? new Date());
    }
    setOpen(nextOpen);
  }

  function selectDate(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
  }

  return (
    <div className={className}>
      {label ? <span id={labelId} className={cn(labelClassName ?? "technical-label mb-1 block")}>{label}</span> : null}
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
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
            <span className={selectedDate ? undefined : "text-[var(--text-muted)]"}>{selectedDate ? DATE_FORMATTER.format(selectedDate) : "Select date"}</span>
            <CalendarDays className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={8}
            className="workspace-content-light z-[70] w-[21rem] rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-panel-elevated)] p-0 text-[var(--text-primary)] shadow-[var(--elevation-raised)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          >
          <div className="border-b border-[var(--rule-default)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Choose date</p>
          </div>

          <div className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)]"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <p className="font-medium text-[var(--text-primary)]">{MONTH_FORMATTER.format(visibleMonth)}</p>
              <button
                type="button"
                onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)]"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAY_LABELS.map((weekday) => <span key={weekday} className="py-1 text-xs font-medium text-[var(--text-muted)]">{weekday}</span>)}
              {calendarDays.map((day) => {
                const isSelected = day.value === value;
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => selectDate(day.value)}
                    aria-label={DATE_FORMATTER.format(day.date)}
                    aria-pressed={isSelected}
                    className={cn(
                      "h-9 rounded-md text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]",
                      isSelected
                        ? "bg-[var(--action-primary-bg)] text-[var(--action-primary-ink)]"
                        : day.inCurrentMonth
                          ? "text-[var(--text-primary)] hover:bg-[var(--surface-panel-strong)]"
                          : "text-[var(--text-muted)] hover:bg-[var(--surface-panel-alt)]",
                    )}
                  >
                    {day.date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[var(--rule-default)] pt-3">
              {allowClear ? (
                <button
                  type="button"
                  onClick={() => selectDate("")}
                  className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Clear date
                </button>
              ) : <span />}
              <button
                type="button"
                onClick={() => selectDate(formatCalendarDate(new Date()))}
                className="text-sm font-semibold text-[var(--text-accent)] hover:text-[var(--action-primary-bg-hover)]"
              >
                Today
              </button>
            </div>
          </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

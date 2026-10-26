"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "radix-ui";
import {
  calendarYearOptions,
  formatCalendarDate,
  getCalendarDays,
  isCalendarDayDisabled,
  monthIsAfter,
  parseCalendarDate,
} from "@/lib/calendar-date";
import { cn } from "@/lib/utils";
import { CalendarMenu } from "@/components/ui/calendar-menu";

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const MONTH_NAMES = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(2026, month, 1)));
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
  /** Shows month and year menus so a distant date, such as a birth year, is a few taps away. */
  jumpToMonthAndYear?: boolean;
  /** Latest date that can be chosen (YYYY-MM-DD). Later days are disabled. */
  maxValue?: string;
  /** Oldest year offered in the year menu. */
  minYear?: number;
  /** Newest year offered when there is no latest date. Defaults to five years ahead. */
  maxYear?: number;
  /** Shows the "Today" shortcut. Turn off for dates that are never today, such as birthdays. */
  showToday?: boolean;
  placeholder?: string;
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
  jumpToMonthAndYear = true,
  maxValue,
  minYear = new Date().getFullYear() - 10,
  maxYear,
  showToday = true,
  placeholder = "Select date",
}: ProductionDatePickerProps) {
  const labelId = useId();
  const scrollGuardCleanup = useRef<(() => void) | null>(null);
  const [open, setOpen] = useState(false);
  const selectedDate = parseCalendarDate(value);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? new Date());
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const maxDate = maxValue ? parseCalendarDate(maxValue) : null;
  const yearOptions = useMemo(
    () => calendarYearOptions(maxDate?.getFullYear() ?? maxYear ?? new Date().getFullYear() + 5, minYear),
    [maxDate, maxYear, minYear],
  );
  const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);

  // A dialog locks page scrolling and ignores anything outside its own content. When the screen is
  // short enough that the calendar scrolls, stop wheel and touch at the calendar so it still can.
  // The calendar is portaled and mounts a render after it opens, so this attaches through a
  // callback ref the moment the element exists.
  const scrollGuardRef = useCallback((node: HTMLDivElement | null) => {
    scrollGuardCleanup.current?.();
    scrollGuardCleanup.current = null;
    if (!node) return;
    const keepScrollHere = (event: Event) => event.stopPropagation();
    node.addEventListener("wheel", keepScrollHere, { passive: true });
    node.addEventListener("touchmove", keepScrollHere, { passive: true });
    scrollGuardCleanup.current = () => {
      node.removeEventListener("wheel", keepScrollHere);
      node.removeEventListener("touchmove", keepScrollHere);
    };
  }, []);

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
            <span className={selectedDate ? undefined : "text-[var(--text-muted)]"}>{selectedDate ? DATE_FORMATTER.format(selectedDate) : placeholder}</span>
            <CalendarDays className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
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
            <p className="text-sm font-semibold text-[var(--text-primary)]">Choose date</p>
          </div>

          <div className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--surface-panel-alt)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)]"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              {jumpToMonthAndYear ? (
                <div className="flex items-center gap-2">
                  <CalendarMenu
                    label="Month"
                    value={visibleMonth.getMonth()}
                    options={MONTH_NAMES.map((name, month) => ({ value: month, label: name }))}
                    onChange={(month) => setVisibleMonth(new Date(visibleMonth.getFullYear(), month, 1))}
                  />
                  <CalendarMenu
                    label="Year"
                    value={visibleMonth.getFullYear()}
                    options={yearOptions.map((year) => ({ value: year, label: String(year) }))}
                    onChange={(year) => setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1))}
                  />
                </div>
              ) : (
                <p className="font-medium text-[var(--text-primary)]">{MONTH_FORMATTER.format(visibleMonth)}</p>
              )}
              <button
                type="button"
                onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                disabled={monthIsAfter(nextMonth, maxValue)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--surface-panel-alt)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)] disabled:opacity-40"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAY_LABELS.map((weekday) => <span key={weekday} className="py-1 text-xs font-medium text-[var(--text-muted)]">{weekday}</span>)}
              {calendarDays.map((day) => {
                const isSelected = day.value === value;
                const disabled = isCalendarDayDisabled(day.value, maxValue);
                return (
                  <button
                    key={day.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectDate(day.value)}
                    aria-label={DATE_FORMATTER.format(day.date)}
                    aria-pressed={isSelected}
                    className={cn(
                      "h-9 rounded-md text-sm font-medium disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]",
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
              {showToday ? (
                <button
                  type="button"
                  onClick={() => selectDate(formatCalendarDate(new Date()))}
                  className="text-sm font-semibold text-[var(--text-accent)] hover:text-[var(--action-primary-bg-hover)]"
                >
                  Today
                </button>
              ) : <span />}
            </div>
          </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

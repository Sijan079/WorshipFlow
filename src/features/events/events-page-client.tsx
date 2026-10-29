"use client";

import { useMemo, useState, type FormEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { paginate } from "@/lib/list-pagination";
import { useMediaQuery } from "@/lib/use-media-query";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import { detailsCardOpen, getMonthCells, groupByLocalDate } from "./calendar";
import EventDetails from "./event-details";
import EventMonthGrid, { EventMonthSkeleton, datePrefix } from "./event-month-grid";
import EventNewForm from "./event-new-form";
import { buildCreatePayload, formProblem, initialForm, type NewEventForm } from "./event-form";
import { eventColorTokens } from "./event-colors";
import { monthLabel, timeLabel } from "./event-labels";
import { reviewBannerText } from "./event-status";
import type { EventListResponse, EventOccurrenceSummary } from "./event-types";

const ICON_BUTTON = "inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-accent)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]";

function EventsSkeleton() {
  return (
    <div role="status" aria-label="Loading events" className="divide-y divide-[var(--rule-default)]">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-4">
          <div className="h-5 w-14 animate-pulse rounded bg-[var(--surface-panel-strong)]" />
          <div className="space-y-2">
            <div className="h-5 w-48 animate-pulse rounded bg-[var(--surface-panel-strong)]" />
            <div className="h-4 w-28 animate-pulse rounded bg-[var(--surface-panel-strong)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EventsPageClient({ initialDate }: { initialDate: string }) {
  const initialYear = Number(initialDate.slice(0, 4));
  const initialMonth = Number(initialDate.slice(5, 7)) - 1;
  const [month, setMonth] = useState({ year: initialYear, index: initialMonth });
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "list">("month");
  const [reviewMode, setReviewMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  // The details card beside the calendar starts closed and opens when an event or a day with events is chosen.
  const [opened, setOpened] = useState(false);
  const [listPage, setListPage] = useState(1);
  const [form, setForm] = useState<NewEventForm>(() => initialForm(initialDate));
  const [formProblemText, setFormProblemText] = useState("");
  const queryClient = useQueryClient();
  const wide = useMediaQuery("(min-width: 768px)");
  const xl = useMediaQuery("(min-width: 1280px)");
  const cells = useMemo(() => getMonthCells(month.year, month.index), [month]);
  const from = cells[0]?.date;
  const to = cells.at(-1)?.date;
  const eventQuery = useQuery({
    queryKey: ["events", from, to],
    queryFn: () => apiFetch<EventListResponse>(`/api/events?from=${from}&to=${to}`),
    enabled: Boolean(from && to),
    placeholderData: keepPreviousData,
  });
  const reviewQuery = useQuery({
    queryKey: ["events", "review"],
    queryFn: () => apiFetch<EventListResponse>("/api/events?review=1"),
    enabled: reviewMode,
  });
  const calendarItems = useMemo(() => eventQuery.data?.items ?? [], [eventQuery.data?.items]);
  const reviewItems = useMemo(() => reviewQuery.data?.items ?? [], [reviewQuery.data?.items]);
  // In review mode the list is the one-time events that ended without being marked done or cancelled.
  const items = reviewMode ? reviewItems : calendarItems;
  const byDate = useMemo(() => groupByLocalDate(calendarItems), [calendarItems]);
  // The month grid keeps a side panel on a wide screen. A list, and any phone, opens an event under its own row.
  const inline = !wide;
  const listMode = inline || reviewMode || view === "list";
  const selected = items.find((item) => item.id === selectedId) ?? (listMode ? undefined : byDate.get(selectedDate)?.[0]);
  const listing = paginate(items, listPage);
  const bannerText = reviewBannerText(eventQuery.data?.needsReviewCount ?? 0);
  const data = eventQuery.data;
  // The review list loads on its own, after Review is pressed. Until it has really loaded, show that it is
  // loading (or that it failed), instead of the "Nothing to review" message, which would be wrong.
  // Changing month keeps the previous month's data only as a placeholder underneath, so the page's flags and
  // buttons keep working. It is not shown: the new month shows a skeleton until it has loaded, so the old
  // events can never be mistaken for the new month's.
  const monthLoading = !reviewMode && (eventQuery.isPending || eventQuery.isPlaceholderData);
  const reviewLoading = reviewMode && reviewQuery.isPending;
  const reviewFailed = reviewMode && reviewQuery.isError;
  const cardOpen = !inline && detailsCardOpen({ showForm, opened, hasSelection: Boolean(selected) });
  const createEvent = useMutation({
    mutationFn: (value: NewEventForm) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      return apiFetch<{ id: string }>("/api/events", { method: "POST", body: JSON.stringify(buildCreatePayload(value, timezone)) });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      setSelectedDate(form.date);
      setMonth({ year: Number(form.date.slice(0, 4)), index: Number(form.date.slice(5, 7)) - 1 });
      setSelectedId(null);
      setListPage(1);
      setShowForm(false);
      setOpened(false);
    },
  });

  function closeCard() {
    setOpened(false);
    setShowForm(false);
    setSelectedId(null);
  }

  function moveMonth(delta: number) {
    const date = new Date(Date.UTC(month.year, month.index + delta, 1));
    setMonth({ year: date.getUTCFullYear(), index: date.getUTCMonth() });
    setSelectedDate(date.toISOString().slice(0, 10));
    setSelectedId(null);
    setListPage(1);
    setShowForm(false);
    setOpened(false);
  }

  function goToToday() {
    const today = new Date();
    setMonth({ year: today.getFullYear(), index: today.getMonth() });
    setSelectedDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
    setSelectedId(null);
    setListPage(1);
    setShowForm(false);
    setOpened(false);
  }

  function chooseView(next: "month" | "list") {
    setView(next);
    setSelectedId(null);
    setListPage(1);
    setOpened(false);
  }

  function openNewEvent(date = selectedDate) {
    setForm(initialForm(date));
    createEvent.reset();
    setFormProblemText("");
    setShowForm(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = formProblem(form);
    if (problem) {
      setFormProblemText(problem);
      return;
    }
    setFormProblemText("");
    createEvent.mutate(form);
  }

  const newForm = (
    <EventNewForm
      form={form}
      setForm={setForm}
      problem={formProblemText}
      error={createEvent.isError ? (createEvent.error instanceof Error ? createEvent.error.message : "Unable to save event.") : ""}
      saving={createEvent.isPending}
      onSubmit={submit}
      onCancel={() => setShowForm(false)}
    />
  );
  const details = (item: EventOccurrenceSummary) => data ? <EventDetails key={item.id} item={item} canEdit={data.canEdit} canDelete={data.canDelete} canAnnounce={data.canCreateAnnouncement} /> : null;

  // Side by side on a wide screen, the details column grows from nothing and shrinks back, so the calendar or
  // list glides to its new width instead of jumping. Below that the card stacks under the register.
  const columns = xl ? {
    display: "grid",
    alignItems: "start",
    gridTemplateColumns: cardOpen ? "minmax(0,1fr) 360px" : "minmax(0,1fr) 0px",
    columnGap: cardOpen ? 16 : 0,
    transition: "grid-template-columns 260ms var(--ease-out), column-gap 260ms var(--ease-out)",
  } as const : undefined;

  return (
    <MotionConfig reducedMotion="user">
    <section className="min-h-[calc(100vh-8rem)] space-y-6 text-[var(--text-primary)]">
      <header className="ui-page-header flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="ui-page-title text-3xl font-semibold leading-10">Events</h1>
          <p className="ui-page-description">See and plan church events on a calendar, with a registration link when one is needed.</p>
        </div>
        {data?.canCreate ? <button type="button" onClick={() => openNewEvent()} className="ui-btn-primary pressable inline-flex items-center justify-center gap-2 self-start px-4 py-2.5 text-sm font-semibold sm:self-auto"><Plus aria-hidden="true" className="h-4 w-4" />New event</button> : null}
      </header>

      {!reviewMode && bannerText ? (
        <button type="button" onClick={() => { setReviewMode(true); setSelectedId(null); setOpened(false); setListPage(1); setShowForm(false); }} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md bg-[var(--state-warning-soft)] px-4 text-left text-sm font-medium text-[var(--state-warning)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]">
          <span>{bannerText}</span>
          <span className="shrink-0 underline underline-offset-2">Review</span>
        </button>
      ) : null}

      <div style={columns} className={xl ? "motion-reduce:!transition-none" : "space-y-4"}>
      <section className="ui-surface-elevated ui-operational-register min-w-0">
        <div className="ui-register-toolbar">
          {reviewMode ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Past Events to Review</h2>
              <button type="button" onClick={() => { setReviewMode(false); setSelectedId(null); setOpened(false); setListPage(1); }} aria-label="Back to calendar" title="Back to calendar" className={ICON_BUTTON}><ArrowLeft aria-hidden="true" className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1">
                <h2 className="min-w-40 text-lg font-semibold">{monthLabel(month.year, month.index)}</h2>
                <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month" title="Previous month" className={ICON_BUTTON}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
                <button type="button" onClick={() => moveMonth(1)} aria-label="Next month" title="Next month" className={ICON_BUTTON}><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
                <button type="button" onClick={goToToday} className="ui-btn-secondary pressable ml-2 inline-flex items-center px-3 text-sm font-semibold">Today</button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex rounded-md border border-[var(--border-default)] p-0.5" role="group" aria-label="Calendar view">
                  <button type="button" onClick={() => chooseView("month")} aria-pressed={view === "month"} className={`min-h-10 rounded px-3 text-sm ${view === "month" ? "bg-[var(--surface-panel-strong)] font-semibold text-[var(--text-accent)]" : "text-[var(--text-secondary)]"}`}>Month</button>
                  <button type="button" onClick={() => chooseView("list")} aria-pressed={view === "list"} className={`min-h-10 rounded px-3 text-sm ${view === "list" ? "bg-[var(--surface-panel-strong)] font-semibold text-[var(--text-accent)]" : "text-[var(--text-secondary)]"}`}>List</button>
                </div>
                <button type="button" onClick={() => void eventQuery.refetch()} aria-label="Refresh events" title="Refresh events" className={ICON_BUTTON}><RefreshCw aria-hidden="true" className={eventQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></button>
              </div>
            </div>
          )}
        </div>

        {monthLoading || reviewLoading ? (
          !reviewMode && !listMode ? <EventMonthSkeleton cells={cells} /> : <EventsSkeleton />
        ) : null}
        {eventQuery.isError || reviewFailed ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 bg-[var(--state-danger-soft)] px-4 py-3 text-sm text-[var(--state-danger)]">
            <p>{reviewFailed ? "The events to review" : "Events"} could not be loaded. {(reviewFailed ? reviewQuery : eventQuery).error instanceof Error ? (reviewFailed ? reviewQuery : eventQuery).error?.message : ""}</p>
            <button type="button" onClick={() => void (reviewFailed ? reviewQuery : eventQuery).refetch()} className="ui-btn-secondary pressable inline-flex items-center px-4 text-sm font-semibold">Retry</button>
          </div>
        ) : null}

        {data && !monthLoading && !reviewLoading && !reviewFailed ? (listMode ? (
          <div>
            {showForm && inline ? <div className="border-b border-[var(--rule-default)] p-4 lg:px-6"><div className="max-w-xl">{newForm}</div></div> : null}
            {items.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center"><CalendarDays aria-hidden="true" className="mb-3 h-7 w-7 text-[var(--text-muted)]" /><p className="font-medium">{reviewMode ? "Nothing to review" : "No events in this month"}</p><p className="mt-1 text-sm text-[var(--text-muted)]">{reviewMode ? "Past events that were not marked done or cancelled show here." : "Scheduled events will appear here."}</p></div>
            ) : (
              <>
                <ul>
                  {listing.items.map((item, row) => {
                    // On a phone a chosen row stays chosen; on a wide screen it is chosen only while the card is open.
                    const open = item.id === selected?.id && (inline || cardOpen);
                    return (
                      <motion.li key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(row * 0.03, 0.2) }} className={`border-b border-[var(--rule-default)] ${open ? "relative before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[var(--action-primary-bg)]" : ""}`}>
                        <button type="button" aria-expanded={open} onClick={() => { setSelectedDate(item.localDate); setSelectedId(open ? null : item.id); setOpened(!open); setShowForm(false); }} className="flex min-h-16 w-full items-center gap-4 px-4 py-3 text-left hover:bg-[var(--surface-panel-alt)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]">
                          <span className="w-14 shrink-0 text-sm font-semibold text-[var(--text-secondary)]">{item.localDate.slice(5)}</span>
                          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.status === "CANCELLED" ? "var(--text-muted)" : eventColorTokens(item.color).dot }} />
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm font-semibold ${item.status === "CANCELLED" ? "text-[var(--text-muted)] line-through" : ""}`}>{datePrefix(item)}{item.title}</span>
                            <span className="block truncate text-xs text-[var(--text-muted)]">{timeLabel(item.startsAt, item.timezone)}{item.venue ? ` · ${item.venue}` : ""}</span>
                          </span>
                          {item.conflict ? <span className="text-xs font-semibold text-[var(--state-warning)]">Overlap</span> : null}
                        </button>
                        <AnimatePresence initial={false}>
                          {open && inline ? (
                            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                              <section aria-label="Event details" className="max-w-2xl px-4 pb-5 pt-1 lg:px-6">{details(item)}</section>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </motion.li>
                    );
                  })}
                </ul>
                <ListPaginationFooter {...listing} noun="events" onPageChange={setListPage} />
              </>
            )}
          </div>
        ) : (
          <motion.div key={`${month.year}-${month.index}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="min-w-0">
            <EventMonthGrid
              cells={cells}
              byDate={byDate}
              selectedDate={selectedDate}
              onSelectDate={(date) => { setSelectedDate(date); setSelectedId(null); setShowForm(false); setOpened((byDate.get(date)?.length ?? 0) > 0); }}
              onSelectEvent={(date, id) => { setSelectedDate(date); setSelectedId(id); setShowForm(false); setOpened(true); }}
            />
            {calendarItems.length === 0 ? <p className="border-t border-[var(--rule-default)] px-4 py-3 text-sm text-[var(--text-muted)]">No events in this month. Scheduled events will appear on these dates.</p> : null}
          </motion.div>
        )) : null}
      </section>

      {/* The column clips the card while it is wider than its track, but leaves room for its shadow. */}
      <div className={xl ? "min-w-0 [overflow-clip-margin:24px] [overflow:clip]" : undefined}>
        <AnimatePresence>
          {cardOpen ? <motion.aside key="card" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.22, ease: "easeOut" }} className="ui-surface-elevated relative min-w-0 p-5 pt-12 xl:w-[360px]" aria-label="Event details">
            <button type="button" onClick={closeCard} aria-label="Close event details" title="Close" className={`${ICON_BUTTON} absolute right-2 top-2`}><X aria-hidden="true" className="h-4 w-4" /></button>
            <motion.div key={showForm ? "form" : selected?.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
              {showForm ? newForm : selected ? details(selected) : null}
            </motion.div>
          </motion.aside> : null}
        </AnimatePresence>
      </div>
      </div>
    </section>
    </MotionConfig>
  );
}

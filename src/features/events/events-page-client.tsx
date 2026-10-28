"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { getMonthCells, groupByLocalDate } from "./calendar";
import EventDetails from "./event-details";
import EventFormFields from "./event-form-fields";
import { buildCreatePayload, formProblem, initialForm, type NewEventForm } from "./event-form";
import { fullDateLabel, monthLabel, timeLabel } from "./event-labels";
import { needsReview, reviewBannerText } from "./event-status";
import type { EventListResponse, EventOccurrenceSummary } from "./event-types";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// A short word before the title when a date is not simply scheduled.
function datePrefix(item: EventOccurrenceSummary) {
  if (item.status === "CANCELLED") return "Cancelled · ";
  if (item.doneAt) return "Done · ";
  if (needsReview(item)) return "Needs review · ";
  return item.conflict ? "Overlap · " : "";
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
  const [form, setForm] = useState<NewEventForm>(() => initialForm(initialDate));
  const [formProblemText, setFormProblemText] = useState("");
  const queryClient = useQueryClient();
  const cells = useMemo(() => getMonthCells(month.year, month.index), [month]);
  const from = cells[0]?.date;
  const to = cells.at(-1)?.date;
  const eventQuery = useQuery({
    queryKey: ["events", from, to],
    queryFn: () => apiFetch<EventListResponse>(`/api/events?from=${from}&to=${to}`),
    enabled: Boolean(from && to),
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
  const selected = items.find((item) => item.id === selectedId) ?? (reviewMode ? undefined : byDate.get(selectedDate)?.[0]);
  const bannerText = reviewBannerText(eventQuery.data?.needsReviewCount ?? 0);
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
      setShowForm(false);
    },
  });

  function moveMonth(delta: number) {
    const date = new Date(Date.UTC(month.year, month.index + delta, 1));
    setMonth({ year: date.getUTCFullYear(), index: date.getUTCMonth() });
    setSelectedDate(date.toISOString().slice(0, 10));
    setSelectedId(null);
    setShowForm(false);
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

  return (
    <section className="min-h-[calc(100vh-8rem)] text-[var(--text-primary)]">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Events</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">See and plan church events on a calendar, with a registration link when one is needed.</p>
        </div>
        {eventQuery.data?.canCreate ? <button type="button" onClick={() => openNewEvent()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--action-primary-bg)] px-4 text-sm font-semibold text-[var(--action-primary-ink)] hover:bg-[var(--action-primary-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"><Plus aria-hidden="true" className="h-4 w-4" /> New event</button> : null}
      </header>

      {reviewMode ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Past events to review</h2>
          <button type="button" onClick={() => { setReviewMode(false); setSelectedId(null); }} className="inline-flex min-h-11 items-center rounded-md border border-[var(--border-default)] px-4 text-sm font-semibold hover:bg-[var(--surface-panel-alt)]">Back to calendar</button>
        </div>
      ) : bannerText ? (
        <button type="button" onClick={() => { setReviewMode(true); setSelectedId(null); setShowForm(false); }} className="mb-4 flex min-h-11 w-full items-center justify-between gap-3 rounded-md bg-[var(--state-warning-soft)] px-4 text-left text-sm font-medium text-[var(--state-warning)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]">
          <span>{bannerText}</span>
          <span className="shrink-0 underline underline-offset-2">Review</span>
        </button>
      ) : null}

      <div className={reviewMode ? "hidden" : "mb-4 flex flex-wrap items-center justify-between gap-3"}>
        <div className="flex min-h-11 items-center gap-2">
          <h2 className="min-w-44 text-xl font-semibold">{monthLabel(month.year, month.index)}</h2>
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border-default)] hover:bg-[var(--surface-panel-alt)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]"><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Next month" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border-default)] hover:bg-[var(--surface-panel-alt)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]"><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-[var(--border-default)] p-1" role="group" aria-label="Calendar view">
            <button type="button" onClick={() => setView("month")} aria-pressed={view === "month"} className={`min-h-9 rounded px-3 text-sm ${view === "month" ? "bg-[var(--surface-panel-strong)] font-semibold text-[var(--text-accent)]" : "text-[var(--text-secondary)]"}`}>Month</button>
            <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={`min-h-9 rounded px-3 text-sm ${view === "list" ? "bg-[var(--surface-panel-strong)] font-semibold text-[var(--text-accent)]" : "text-[var(--text-secondary)]"}`}>List</button>
          </div>
          <button type="button" onClick={() => { const today = new Date(); setMonth({ year: today.getFullYear(), index: today.getMonth() }); setSelectedDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`); setSelectedId(null); setShowForm(false); }} className="min-h-11 rounded-md border border-[var(--border-default)] px-3 text-sm font-medium hover:bg-[var(--surface-panel-alt)]">Today</button>
        </div>
      </div>

      {eventQuery.isPending ? <p role="status" className="py-12 text-sm text-[var(--text-muted)]">Loading events…</p> : null}
      {eventQuery.isError ? <div role="alert" className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-5 text-sm"><p>Events could not be loaded. {eventQuery.error instanceof Error ? eventQuery.error.message : ""}</p><button type="button" onClick={() => void eventQuery.refetch()} className="mt-3 font-semibold text-[var(--text-accent)] underline">Try again</button></div> : null}
      {eventQuery.isSuccess ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-[var(--elevation-subtle)]">
            {!reviewMode && view === "month" ? (
              <>
                <div className="hidden grid-cols-7 border-b border-[var(--border-default)] md:grid">{weekDays.map((day) => <span key={day} className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{day}</span>)}</div>
                <div className="hidden grid-cols-7 md:grid">
                  {cells.map((cell) => {
                    const dayItems = byDate.get(cell.date) ?? [];
                    return <div key={cell.date} onClick={() => { setSelectedDate(cell.date); setSelectedId(null); setShowForm(false); }} className={`min-h-28 cursor-pointer border-b border-r border-[var(--border-default)] p-1.5 hover:bg-[var(--surface-panel-alt)] ${selectedDate === cell.date ? "bg-[var(--surface-panel-strong)]" : cell.inMonth ? "" : "bg-[var(--surface-panel-alt)]"}`}>
                      <button type="button" onClick={() => { setSelectedDate(cell.date); setSelectedId(null); setShowForm(false); }} aria-label={fullDateLabel(cell.date)} aria-pressed={selectedDate === cell.date} className={`mb-1 flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] ${selectedDate === cell.date ? "bg-[var(--action-primary-bg)] text-[var(--action-primary-ink)]" : cell.inMonth ? "text-[var(--text-primary)] hover:bg-[var(--surface-panel-strong)]" : "text-[var(--text-muted)]"}`}>{Number(cell.date.slice(-2))}</button>
                      {dayItems.slice(0, 3).map((item) => <button type="button" key={item.id} onClick={(event) => { event.stopPropagation(); setSelectedDate(cell.date); setSelectedId(item.id); setShowForm(false); }} className={`mb-1 block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] ${item.status === "CANCELLED" ? "bg-[var(--surface-panel-alt)] text-[var(--text-muted)] line-through" : item.conflict ? "bg-[var(--state-warning-soft)] text-[var(--state-warning)]" : "bg-[var(--surface-panel-strong)] text-[var(--text-accent)]"}`}>{datePrefix(item)}{item.title}</button>)}
                      {dayItems.length > 3 ? <span className="px-1 text-xs text-[var(--text-muted)]">+{dayItems.length - 3} more</span> : null}
                    </div>;
                  })}
                </div>
                {items.length === 0 ? <p className="hidden border-t border-[var(--border-default)] px-4 py-3 text-sm text-[var(--text-muted)] md:block">No events in this month. Scheduled events will appear on these dates.</p> : null}
              </>
            ) : null}
            <div className={!reviewMode && view === "month" ? "p-3 md:hidden" : "p-3"}>
              {items.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center"><CalendarDays aria-hidden="true" className="mb-3 h-7 w-7 text-[var(--text-muted)]" /><p className="font-medium">No events in this month</p><p className="mt-1 text-sm text-[var(--text-muted)]">Scheduled events will appear here.</p></div> : (
                <div className="divide-y divide-[var(--border-default)]">
                  {items.map((item) => <button type="button" key={item.id} onClick={() => { setSelectedDate(item.localDate); setSelectedId(item.id); setShowForm(false); }} className="flex min-h-16 w-full items-center gap-4 px-2 py-3 text-left hover:bg-[var(--surface-panel-alt)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]"><span className="w-14 shrink-0 text-sm font-semibold text-[var(--text-secondary)]">{item.localDate.slice(5)}</span><span className="min-w-0 flex-1"><span className={`block truncate text-sm font-semibold ${item.status === "CANCELLED" ? "text-[var(--text-muted)] line-through" : ""}`}>{datePrefix(item)}{item.title}</span><span className="block truncate text-xs text-[var(--text-muted)]">{timeLabel(item.startsAt, item.timezone)}{item.venue ? ` · ${item.venue}` : ""}</span></span>{item.conflict ? <span className="text-xs font-semibold text-[var(--state-warning)]">Overlap</span> : null}</button>)}
                </div>
              )}
            </div>
          </div>

          <aside className="min-h-64 rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-5 shadow-[var(--elevation-subtle)]" aria-label="Event details">
            {showForm ? <form onSubmit={submit} className="space-y-4">
              <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold">New event</h2><button type="button" onClick={() => setShowForm(false)} className="text-sm text-[var(--text-secondary)] underline">Cancel</button></div>
              <EventFormFields form={form} setForm={setForm} />
              {formProblemText ? <p role="alert" className="text-sm text-[var(--state-danger)]">{formProblemText}</p> : null}
              {createEvent.isError ? <p role="alert" className="text-sm text-[var(--state-danger)]">{createEvent.error instanceof Error ? createEvent.error.message : "Unable to save event."}</p> : null}
              <button type="submit" disabled={createEvent.isPending} className="min-h-11 w-full rounded-md bg-[var(--action-primary-bg)] px-4 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60">{createEvent.isPending ? "Saving…" : "Create event"}</button>
            </form> : selected ? <EventDetails key={selected.id} item={selected} canEdit={eventQuery.data.canEdit} canDelete={eventQuery.data.canDelete} canAnnounce={eventQuery.data.canCreateAnnouncement} /> : <div><p className="text-sm font-semibold text-[var(--text-secondary)]">{fullDateLabel(selectedDate)}</p><h2 className="mt-3 text-lg font-semibold">No event selected</h2><p className="mt-2 text-sm text-[var(--text-muted)]">Choose an event on the calendar to see its details.</p>{eventQuery.data.canCreate ? <button type="button" onClick={() => openNewEvent(selectedDate)} className="mt-4 text-sm font-semibold text-[var(--text-accent)] underline">Add an event on this date</button> : null}</div>}
          </aside>
        </div>
      ) : null}
    </section>
  );
}

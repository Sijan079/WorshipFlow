// Pulsing placeholders shown while data loads, in the shape of what is coming, so the page does not jump when
// it arrives. Use these instead of a "Loading…" line. The pulse stops for people who ask for reduced motion.

const PULSE = "animate-pulse bg-[var(--surface-panel-strong)]";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded ${PULSE} ${className}`} />;
}

// Several lines of text, the last one shorter.
export function SkeletonText({ label, lines = 3, className = "" }: { label: string; lines?: number; className?: string }) {
  return <div role="status" aria-label={label} className={`space-y-2.5 ${className}`}>
    {Array.from({ length: lines }, (_, index) => <Skeleton key={index} className={`h-4 ${index === lines - 1 ? "w-2/3" : "w-full"}`} />)}
  </div>;
}

// A list of rows, each with a round or square mark and two lines (a person, a notification, an item).
export function SkeletonRows({ label, rows = 4, round = false, className = "" }: { label: string; rows?: number; round?: boolean; className?: string }) {
  return <div role="status" aria-label={label} className={`divide-y divide-[var(--border-default)] ${className}`}>
    {Array.from({ length: rows }, (_, index) => <div key={index} className="flex items-center gap-4 px-4 py-4 sm:px-6">
      <Skeleton className={`size-10 shrink-0 ${round ? "!rounded-full" : ""}`} />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
    </div>)}
  </div>;
}

// A bordered panel holding rows, for a section that is a card.
export function SkeletonPanel({ label, rows = 4, round = false }: { label: string; rows?: number; round?: boolean }) {
  return <div className="overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-[var(--elevation-subtle)]">
    <SkeletonRows label={label} rows={rows} round={round} />
  </div>;
}

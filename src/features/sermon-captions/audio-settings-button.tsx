import { SlidersHorizontal } from "lucide-react";

// A quiet, icon-only control beside Start captions: no border and no fill, so Start stays the one
// thing that looks like a button. It carries a label and a tooltip because it has no words.
export default function AudioSettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Audio input settings"
      title="Audio input settings"
      className="pressable inline-flex min-h-11 min-w-11 items-center justify-center self-start rounded-[var(--radius-control)] border-0 bg-transparent px-0 text-[var(--text-secondary)] shadow-none hover:text-[var(--text-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] sm:self-auto"
    >
      <SlidersHorizontal className="h-5 w-5" />
    </button>
  );
}

import { Share2 } from "lucide-react";

// A quiet, icon-only control beside the options button. It has no words, so it carries a label and
// a tooltip.
export default function ShareButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Share captions link"
      title="Share captions link"
      className="pressable inline-flex min-h-11 min-w-11 items-center justify-center self-start rounded-[var(--radius-control)] border-0 bg-transparent px-0 text-[var(--text-secondary)] shadow-none hover:text-[var(--text-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] sm:self-auto"
    >
      <Share2 className="h-5 w-5" />
    </button>
  );
}

import type { CaptionLine } from "./caption-session-api";

export default function CaptionPreview({ lines }: { lines: CaptionLine[] }) {
  return (
    <div className="min-h-52 flex-1 bg-[var(--surface-panel-alt)] px-4 py-5 sm:px-6" aria-live="polite" aria-relevant="additions text">
      {lines.length ? (
        <div className="space-y-3">
          {lines.map((item) => (
            <p key={item.line} className={`text-lg leading-relaxed text-[var(--text-primary)] ${item.final ? "" : "opacity-75"}`}>{item.english}</p>
          ))}
        </div>
      ) : (
        <p className="flex min-h-40 items-center justify-center text-center text-sm text-[var(--text-secondary)]">English captions will appear here after speech is recognized.</p>
      )}
    </div>
  );
}

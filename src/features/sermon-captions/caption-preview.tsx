import type { CaptionLine } from "./caption-session-api";

export default function CaptionPreview({ lines, heard = {} }: { lines: CaptionLine[]; heard?: Record<number, string> }) {
  return (
    <div className="min-h-52 flex-1 bg-[var(--surface-panel-alt)] px-4 py-5 sm:px-6" aria-live="polite" aria-relevant="additions text">
      {lines.length ? (
        <div className="space-y-3">
          {lines.map((item) => (
            <div key={item.line}>
              <p className={`text-lg leading-relaxed text-[var(--text-primary)] ${item.final ? "" : "opacity-75"}`}>{item.english}</p>
              {heard[item.line] ? <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Heard: {heard[item.line]}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="flex min-h-40 items-center justify-center text-center text-sm text-[var(--text-secondary)]">English captions will appear here after speech is recognized.</p>
      )}
    </div>
  );
}

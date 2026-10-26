export default function ViewerLink({ url, onCopy }: { url: string; onCopy: () => void }) {
  return (
    <div className="border-t border-[var(--rule-default)] pt-4">
      <p className="text-sm font-semibold text-[var(--text-primary)]">Text-only viewer</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <a className="break-all text-sm text-[var(--text-accent)] underline underline-offset-2" href={url} target="_blank" rel="noopener noreferrer">{url}</a>
        <button type="button" className="ui-btn-secondary min-h-11 px-3 text-sm font-semibold" onClick={onCopy}>Copy link</button>
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">Anyone with this link can read the English captions during the broadcast and for one hour after it stops.</p>
    </div>
  );
}

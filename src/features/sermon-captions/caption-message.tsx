// What the page is doing, in one plain sentence. It is background text, so it is muted, and it is
// read out by screen readers when it changes.
export default function CaptionMessage({ message }: { message: string }) {
  return <p role="status" className="text-sm text-[var(--text-muted)]">{message}</p>;
}

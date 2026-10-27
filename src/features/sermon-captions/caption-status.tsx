import { captionStatus, type CaptionRunState, type CaptionTone } from "./caption-ui";

// Every status colour is at least 4.5:1 on white, so the label can use the dot's colour as it is.
const DOT: Record<CaptionTone, string> = {
  success: "var(--state-success)",
  warning: "var(--state-warning)",
  danger: "var(--state-danger)",
  neutral: "var(--state-idle)",
};

// A small dot and a label in the same colour: the colour of what the booth is doing right now.
// Red is for errors only. Only Live pulses, so it can be noticed from across the booth. Reduced
// motion is respected globally.
export default function CaptionStatus({ state, hasSession }: { state: CaptionRunState; hasSession: boolean }) {
  const status = captionStatus(state, hasSession);
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: DOT[status.tone] }}>
      <span aria-hidden="true" className="relative flex size-2.5">
        {state === "live" ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: DOT[status.tone] }} />
        ) : null}
        <span className="relative inline-flex size-2.5 rounded-full" style={{ backgroundColor: DOT[status.tone] }} />
      </span>
      {status.label}
    </span>
  );
}

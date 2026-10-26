import { Play, Square } from "lucide-react";
import type { CaptionRunState } from "./caption-ui";

type Props = {
  state: CaptionRunState;
  hasSession: boolean;
  canOperate: boolean;
  canStopExisting: boolean;
  onStart: () => void;
  onStop: () => void;
  onStopExisting: () => void;
};

// The one next action, shown at the top right of the page like Add person and Add service.
// Start is the purple button; stopping is secondary.
export default function CaptionControls({ state, hasSession, canOperate, canStopExisting, onStart, onStop, onStopExisting }: Props) {
  const running = state === "live" || state === "reconnecting" || state === "error" || state === "stopping" || (state === "starting" && hasSession);
  const base = "pressable inline-flex min-h-11 items-center justify-center gap-2 self-start px-4 py-2.5 text-sm font-semibold disabled:opacity-50 sm:self-auto";
  if (running) {
    return (
      <button type="button" onClick={onStop} disabled={state === "stopping"} className={`ui-btn-secondary ${base}`}>
        <Square className="h-4 w-4" />
        Stop captions
      </button>
    );
  }
  if (hasSession) {
    return (
      <button type="button" onClick={onStopExisting} disabled={!canStopExisting} className={`ui-btn-secondary ${base}`}>
        <Square className="h-4 w-4" />
        Stop current session
      </button>
    );
  }
  return (
    <button type="button" onClick={onStart} disabled={!canOperate || state === "starting"} className={`ui-btn-primary ${base}`}>
      <Play className="h-4 w-4" />
      Start captions
    </button>
  );
}

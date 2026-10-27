"use client";

import Link from "next/link";
import { Mic, Square } from "lucide-react";
import { Popover } from "radix-ui";
import CaptionStatus from "./caption-status";
import { captionLiveButtonTone, captionStatus, type CaptionRunState, type LiveButtonTone } from "./caption-ui";

const FILL: Record<LiveButtonTone, string> = {
  live: "var(--action-primary-bg)",
  warning: "var(--state-warning)",
  danger: "var(--state-danger)",
};

// The one floating button in the app, reserved for "something is running for you". It shows while this
// browser is broadcasting captions and the Captions page is not open, pulses so it is noticed, and
// opens a small panel to go back or stop. It sits under dialogs (layer 40, dialogs are 50 and up) and
// above the phone's safe area. Reduced motion is respected globally.
export default function CaptionLiveButton({ state, inputLabel, captionsHref, onStop }: { state: CaptionRunState; inputLabel: string; captionsHref: string; onStop: () => void }) {
  const tone = captionLiveButtonTone(state);
  const label = captionStatus(state, true).label;
  return (
    <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 z-40 sm:right-6">
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`Captions are ${label.toLowerCase()}. Open the captions menu`}
            title={`Captions: ${label}`}
            className="pressable relative flex size-14 items-center justify-center rounded-full text-[var(--action-primary-ink)] shadow-[var(--elevation-raised)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--border-focus)]"
            style={{ backgroundColor: FILL[tone] }}
          >
            <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full opacity-40" style={{ backgroundColor: FILL[tone] }} />
            <Mic className="relative h-6 w-6" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="end"
            sideOffset={12}
            collisionPadding={12}
            className="workspace-content-light z-[70] w-72 max-w-[calc(100vw-1.5rem)] rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-panel-elevated)] p-4 text-sm text-[var(--text-primary)] shadow-[var(--elevation-raised)]"
          >
            <CaptionStatus state={state} hasSession />
            <p className="mt-2 text-[var(--text-secondary)]">
              Listening to <span className="font-semibold text-[var(--text-primary)]">{inputLabel || "the selected input"}</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Popover.Close asChild>
                <Link href={captionsHref} className="ui-btn-secondary pressable inline-flex min-h-11 items-center px-4 text-sm font-semibold">Open Captions</Link>
              </Popover.Close>
              <Popover.Close asChild>
                <button type="button" onClick={onStop} className="ui-btn-danger-solid pressable inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold">
                  <Square className="h-4 w-4" />
                  Stop captions
                </button>
              </Popover.Close>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

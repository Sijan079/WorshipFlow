"use client";

import { Info } from "lucide-react";
import { Popover } from "radix-ui";

// Where the audio goes, behind an information icon beside the dialog title.
export default function AudioPrivacyInfo() {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Where does the audio go?"
          title="Where does the audio go?"
          className="pressable inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:text-[var(--text-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        >
          <Info className="h-5 w-5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={12}
          className="workspace-content-light z-[70] w-80 max-w-[calc(100vw-1.5rem)] rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-panel-elevated)] p-4 text-sm leading-6 text-[var(--text-primary)] shadow-[var(--elevation-raised)]"
        >
          <p>Starting live captions sends the audio from this input to Deepgram, and the recognized text to Azure Translator.</p>
          <p className="mt-2 text-[var(--text-secondary)]">The input test stays on this computer. Nothing is recorded or sent while you test.</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

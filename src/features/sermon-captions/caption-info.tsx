"use client";

import { Info } from "lucide-react";
import { Popover } from "radix-ui";

// What goes in, what comes out, and which input is used, behind one information icon.
export default function CaptionInfo({ inputLabel, running }: { inputLabel: string; running: boolean }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Caption details"
          title="Caption details"
          className="pressable inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:text-[var(--text-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        >
          <Info className="h-5 w-5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="workspace-content-light z-[70] w-80 max-w-[calc(100vw-1.5rem)] rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-panel-elevated)] p-4 text-sm text-[var(--text-primary)] shadow-[var(--elevation-raised)]"
        >
          <dl className="space-y-3">
            <div>
              <dt className="text-[var(--text-secondary)]">From</dt>
              <dd className="mt-0.5 font-medium">Tagalog & English (Speech)</dd>
            </div>
            <div>
              <dt className="text-[var(--text-secondary)]">To</dt>
              <dd className="mt-0.5 font-medium">English (Text)</dd>
            </div>
            <div>
              <dt className="text-[var(--text-secondary)]">Audio input</dt>
              <dd className="mt-0.5 font-medium">
                {inputLabel ? (
                  <>
                    {inputLabel}
                    {running ? <span className="font-normal text-[var(--text-secondary)]"> (listening now)</span> : null}
                  </>
                ) : (
                  <span className="font-normal text-[var(--text-secondary)]">No audio input chosen yet. Use the options button at the top of the page to choose one.</span>
                )}
              </dd>
            </div>
          </dl>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

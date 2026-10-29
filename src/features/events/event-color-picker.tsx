"use client";

import { Check } from "lucide-react";
import { FIELD_LABEL_CLASS } from "@/features/people/field-styles";
import { EVENT_COLORS, eventColorTokens, type EventColor } from "./event-colors";

// The colour of an event on the calendar: a row of round swatches, one chosen at a time. Each swatch has a
// name for screen readers and a tooltip, and a tick shows the chosen one so colour is never the only clue.
export function EventColorPicker({ value, onChange }: { value: string; onChange: (color: EventColor) => void }) {
  return (
    <div>
      <span className={FIELD_LABEL_CLASS}>Color</span>
      <div role="radiogroup" aria-label="Color" className="-mx-1 grid grid-cols-8">
        {EVENT_COLORS.map((color) => {
          const selected = value === color.id;
          return (
            <button
              key={color.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={color.label}
              title={color.label}
              onClick={() => onChange(color.id)}
              className="inline-flex h-11 w-full items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--action-primary-ink)]"
                style={{ background: eventColorTokens(color.id).dot, boxShadow: selected ? `0 0 0 2px var(--surface-panel-elevated), 0 0 0 4px ${eventColorTokens(color.id).dot}` : undefined }}
              >
                {selected ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

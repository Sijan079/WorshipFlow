"use client";

import { useState, useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import {
  ACCENT_THEME_OPTIONS,
  parseAccentTheme,
  saveAccentTheme,
  type AccentTheme,
} from "@/lib/accent-theme";

function subscribeNever() {
  return () => {};
}

function readCurrentTheme(): AccentTheme {
  return parseAccentTheme(document.querySelector("[data-app-theme]")?.getAttribute("data-app-theme"));
}

// Personal setting: saved in a cookie on this device, not on the church. Changing it updates the
// marker the palette keys on, so the whole app recolors at once.
export function AppearanceSection() {
  // The server renders Indigo; the browser then reads the real theme from the marker, with no hydration mismatch.
  const current = useSyncExternalStore(subscribeNever, readCurrentTheme, () => "indigo" as AccentTheme);
  const [chosen, setChosen] = useState<AccentTheme | null>(null);
  const theme = chosen ?? current;

  function choose(next: AccentTheme) {
    saveAccentTheme(next);
    setChosen(next);
  }

  return (
    <section className="ui-surface-elevated overflow-hidden">
      <div className="px-4 py-4 sm:px-6">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Color theme</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Choose the colors you like to look at. This is only for you, on this device. It does not change what other people see.
        </p>
      </div>
      <div role="radiogroup" aria-label="Color theme" className="grid border-t border-[var(--rule-default)] sm:grid-cols-2">
        {ACCENT_THEME_OPTIONS.map((option) => {
          const selected = theme === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(option.id)}
              className={`pressable flex min-h-11 items-start gap-4 border-b border-[var(--rule-default)] px-4 py-4 text-left sm:px-6 ${selected ? "bg-[color-mix(in_oklab,var(--action-primary-bg)_8%,transparent)]" : "hover:bg-[var(--surface-panel-alt)]"}`}
            >
              <span aria-hidden="true" className="mt-0.5 flex h-10 w-16 shrink-0 overflow-hidden rounded-md border border-[var(--border-default)]">
                <span className="w-1/3" style={{ backgroundColor: option.swatch.rail }} />
                <span className="flex-1" style={{ backgroundColor: option.swatch.main }} />
                <span className="w-1/4" style={{ backgroundColor: option.swatch.secondary }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  {option.label}
                  {selected ? (
                    <span className="inline-flex items-center gap-1 text-sm font-normal text-[var(--text-secondary)]">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      In use
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-sm text-[var(--text-secondary)]">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

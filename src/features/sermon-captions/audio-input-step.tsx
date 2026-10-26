"use client";

import { ProductionSelect } from "@/components/ui/production-select";
import { FIELD_LABEL_CLASS } from "@/features/people/field-styles";
import { useAudioInputs } from "./use-audio-inputs";

export type AudioInputChoice = { id: string; label: string };

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]";

// Step 1. While captions run they hold the input, so the level test is replaced by a one-line
// summary. The test (and the stream it opens) goes away with the panel.
export default function AudioInputStep({ input, onInputChange, locked = false }: { input: AudioInputChoice; onInputChange: (input: AudioInputChoice) => void; locked?: boolean }) {
  if (locked) {
    return (
      <p className="text-sm text-[var(--text-primary)]">
        Using <span className="font-semibold">{input.label || "the selected input"}</span> for live captions. Stop captions to change the input.
      </p>
    );
  }
  return <AudioInputPanel input={input} onInputChange={onInputChange} />;
}

function AudioInputPanel({ input, onInputChange }: { input: AudioInputChoice; onInputChange: (input: AudioInputChoice) => void }) {
  const audio = useAudioInputs(input.id);
  const busy = audio.state === "checking" || audio.state === "receiving";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <ProductionSelect
          className="min-w-56 flex-1"
          label="PC recording input"
          labelClassName={FIELD_LABEL_CLASS}
          triggerClassName="min-h-11"
          value={input.id}
          onValueChange={(id) => {
            audio.stopTest();
            onInputChange({ id, label: audio.options.find((option) => option.value === id)?.label ?? "" });
          }}
          options={[{ value: "", label: "Select an input" }, ...audio.options]}
          disabled={audio.options.length === 0}
        />
        {audio.needsPermission ? (
          <button type="button" onClick={() => void audio.revealInputs()} disabled={busy} className={`ui-btn-secondary min-h-11 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}>
            Allow microphone access
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {audio.state === "receiving" ? (
          <button type="button" onClick={audio.stopTest} className={`ui-btn-secondary min-h-11 px-4 text-sm font-semibold ${FOCUS}`}>Stop input test</button>
        ) : (
          <button type="button" onClick={() => void audio.startTest()} disabled={!input.id || audio.state === "checking"} className={`ui-btn-secondary min-h-11 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}>Test audio input</button>
        )}
        <div className="min-w-32 flex-1" aria-label="Input signal level" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={audio.meterPercent}>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-panel-strong)]">
            <div className="h-full bg-[var(--state-success)]" style={{ width: `${audio.meterPercent}%` }} />
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{audio.state === "receiving" ? audio.level === 0 ? "Quiet" : "Signal present" : "Input level"}</p>
        </div>
      </div>
      <p role="status" className={`text-sm ${audio.state === "error" ? "text-[var(--text-danger)]" : "text-[var(--text-secondary)]"}`}>{audio.message}</p>
    </div>
  );
}

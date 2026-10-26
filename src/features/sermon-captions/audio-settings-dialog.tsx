"use client";

import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import AudioInputStep, { type AudioInputChoice } from "./audio-input-step";

type Props = {
  input: AudioInputChoice;
  onInputChange: (input: AudioInputChoice) => void;
  locked: boolean;
  onClose: () => void;
};

// Render this only while it is open: closing unmounts the level test, which stops it and frees
// the device. A choice applies as soon as it is made, so there is nothing to save.
export default function AudioSettingsDialog({ input, onInputChange, locked, onClose }: Props) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Audio input</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[var(--text-secondary)]">
              Select the PC input receiving the Ui24R speech mix.
            </DialogDescription>
          </div>
          <button type="button" onClick={onClose} className="ui-modal-close pressable" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <AudioInputStep input={input} onInputChange={onInputChange} locked={locked} />
          <div className="border-t border-[var(--rule-default)] pt-4 text-sm leading-6 text-[var(--text-secondary)]">
            <p>Ui24R speaking microphones → dedicated AUX output → worship PC Line In.</p>
            <p className="mt-1">The input test stays on this computer. Starting live captions sends this input to Deepgram and the recognized text to Azure Translator.</p>
            <p className="mt-1">The meter shows all sound on that input. If it stays active while the mics are quiet, check which mixer channels feed the AUX.</p>
          </div>
          <div className="flex justify-end pt-2">
            <button type="button" onClick={onClose} className="ui-btn-primary pressable min-h-11 px-4 text-sm font-semibold">Done</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

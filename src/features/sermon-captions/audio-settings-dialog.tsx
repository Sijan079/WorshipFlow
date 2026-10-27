"use client";

import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import AudioHelp from "./audio-help";
import AudioInputStep, { type AudioInputChoice } from "./audio-input-step";
import AudioPrivacyInfo from "./audio-privacy-info";

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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Audio Input</DialogTitle>
            <AudioPrivacyInfo />
          </div>
          <DialogDescription className="sr-only">Choose the PC input used for live captions.</DialogDescription>
          <button type="button" onClick={onClose} className="ui-modal-close pressable" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-5">
          <AudioInputStep input={input} onInputChange={onInputChange} locked={locked} />
          <AudioHelp />
          <div className="flex justify-end pt-2">
            <button type="button" onClick={onClose} className="ui-btn-primary pressable min-h-11 px-4 text-sm font-semibold">Done</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

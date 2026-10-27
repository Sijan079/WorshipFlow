"use client";

import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Props = {
  onConfirm: () => void;
  onCancel: () => void;
};

// Stopping ends the broadcast for everyone reading, so it asks first. It says what will happen, and
// the safe choice (Cancel) is the one the keyboard lands on. Render it only while it is open.
export default function StopConfirmDialog({ onConfirm, onCancel }: Props) {
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Stop Captions?</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Everyone reading will stop getting captions. The last lines stay on the link for one hour.
            </DialogDescription>
          </div>
          <button type="button" onClick={onCancel} className="ui-modal-close pressable" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" autoFocus onClick={onCancel} className="ui-btn-cancel pressable min-h-11 px-4 text-sm font-semibold">Cancel</button>
          <button type="button" onClick={onConfirm} className="ui-btn-primary pressable min-h-11 px-4 text-sm font-semibold">Yes, I am sure</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

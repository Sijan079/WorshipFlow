"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Props = {
  onConfirm: () => void;
  onCancel: () => void;
};

// Dev and production share one hosted database. On a development server, captions started here would
// appear on the church's real listener link, so Start asks first, defaults to Cancel, and needs the box ticked before it can go on.
export default function DevDatabaseDialog({ onConfirm, onCancel }: Props) {
  const [understood, setUnderstood] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Start on the Live Database?</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              This computer is connected to the live database. Test captions will appear on the congregation link.
            </DialogDescription>
          </div>
          <button type="button" onClick={onCancel} className="ui-modal-close pressable" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[var(--text-primary)]">
          <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} className="size-5 shrink-0" />
          I know this is the live database
        </label>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" autoFocus onClick={onCancel} className="ui-btn-cancel pressable min-h-11 px-4 text-sm font-semibold">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={!understood} className="ui-btn-primary pressable min-h-11 px-4 text-sm font-semibold disabled:opacity-50">Yes, I am sure</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

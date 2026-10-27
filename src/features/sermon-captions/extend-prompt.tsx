"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

// Asked once in the last fifteen minutes of a session, so a long service is not cut off. Doing nothing
// lets the session end on time.
export default function ExtendPrompt({ minutesLeft, onExtend, onDismiss }: { minutesLeft: number; onExtend: () => void; onDismiss: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Keep Captions Going?</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          Captions end in {minutesLeft} {minutesLeft === 1 ? "minute" : "minutes"}. Extend them by four hours?
        </DialogDescription>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onDismiss} className="ui-btn-cancel pressable min-h-11 px-4 text-sm font-semibold">Not now</button>
          <button type="button" autoFocus onClick={onExtend} className="ui-btn-primary pressable min-h-11 px-4 text-sm font-semibold">Extend by 4 hours</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

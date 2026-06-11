"use client";

import { PAPUploadPanel } from "./pap-upload-panel";

export default function PAPMobileClient() {
  return (
    <main className="min-h-screen bg-[var(--color-brand-bg)] px-4 py-6 text-[var(--color-text-primary)]">
      <div className="mx-auto max-w-md">
        <header className="mb-5 border-b border-[var(--color-brand-border)] pb-4">
          <h1 className="text-2xl font-semibold">Phone Transfer</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            Upload screenshots to the shared temporary WorshipFlow inbox.
          </p>
        </header>
        <PAPUploadPanel />
      </div>
    </main>
  );
}

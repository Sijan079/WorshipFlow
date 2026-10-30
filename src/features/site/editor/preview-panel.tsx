"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PublicSiteView } from "../public/public-site-view";
import type { PublicSite } from "../public/public-site-data";
import { Skeleton } from "@/components/ui/skeleton";

const DEVICES = [
  { id: "phone", label: "Phone", width: "390px" },
  { id: "tablet", label: "Tablet", width: "768px" },
  { id: "computer", label: "Computer", width: "100%" },
] as const;

type Props = { pageId: string; churchSlug: string; savedKey: string; saving: boolean; unsaved: boolean };

// The page as a visitor will see it, drawn in the width of a phone, a tablet or a computer. It shows the saved
// page, so it is read again each time a save finishes.
export default function PreviewPanel({ pageId, churchSlug, savedKey, saving, unsaved }: Props) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("phone");
  const query = useQuery({ queryKey: ["site-preview", pageId, savedKey], queryFn: () => apiFetch<PublicSite>(`/api/site/pages/${pageId}/preview`), gcTime: 0 });
  const width = DEVICES.find((item) => item.id === device)?.width ?? "100%";

  return (
    <section aria-label="Preview" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Preview width" className="flex flex-wrap gap-2">
          {DEVICES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={device === item.id}
              onClick={() => setDevice(item.id)}
              className={`pressable inline-flex min-h-11 items-center px-4 text-sm font-semibold ${device === item.id ? "ui-btn-primary" : "ui-btn-secondary"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p role="status" className="text-sm text-[var(--text-secondary)]">
          {saving ? "Saving your latest changes…" : unsaved ? "Some changes are not saved yet, so they are not shown here." : "This is how visitors will see the page."}
        </p>
      </div>
      {query.isPending ? <div className="space-y-3 py-6" role="status" aria-label="Loading the preview"><Skeleton className="h-40 w-full" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></div> : null}
      {query.isError ? <p role="alert" className="py-4 text-sm">The preview could not be loaded. <button type="button" className="font-semibold underline" onClick={() => void query.refetch()}>Try again</button></p> : null}
      {query.data ? (
        <div className="flex justify-center overflow-x-auto bg-[var(--surface-panel-alt)] py-4">
          <div style={{ width }} className="max-w-full shrink-0 overflow-hidden border border-[var(--border-default)]">
            <PublicSiteView site={query.data} churchSlug={churchSlug} preview />
          </div>
        </div>
      ) : null}
    </section>
  );
}

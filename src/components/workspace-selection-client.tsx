"use client";

import Link from "next/link";
import { Building2, ChevronRight, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Workspace = { id: string; slug: string; name: string };

export default function WorkspaceSelectionClient({ workspaces }: { workspaces: Workspace[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to create church organization.");
      router.push(`/w/${encodeURIComponent(payload.workspace.slug)}/dashboard`);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create church organization.");
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--surface-canvas)] px-4 py-8 text-[var(--text-primary)] sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 max-w-2xl">
          <p className="ui-technical-label text-[var(--text-accent)]">WORKSPACE ACCESS</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Choose your church organization</h1>
          <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">Select the production workspace you are preparing, or create one for your church.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
          <section className="ui-surface-elevated p-5 sm:p-6" aria-labelledby="available-workspaces">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border-default)] pb-4">
              <div>
                <h2 id="available-workspaces" className="text-lg font-semibold">Available workspaces</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Only active memberships appear here.</p>
              </div>
              <span className="ui-technical-label text-[var(--text-muted)]">{workspaces.length} available</span>
            </div>
            {workspaces.length > 0 ? (
              <div className="mt-4 divide-y divide-[var(--rule-default)]">
                {workspaces.map((workspace) => (
                  <Link key={workspace.id} href={`/w/${encodeURIComponent(workspace.slug)}/dashboard`} className="pressable-subtle flex min-h-16 items-center gap-3 py-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--action-primary-bg)_16%,var(--surface-panel-alt))] text-[var(--text-accent)]"><Building2 className="h-5 w-5" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{workspace.name}</span><span className="ui-meta-text mt-1 block truncate text-xs">/{workspace.slug}</span></span>
                    <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-panel-alt)] p-5 text-sm text-[var(--text-secondary)]">No active workspace yet. Create your church organization to continue.</div>
            )}
          </section>

          <section className="ui-surface-elevated p-5 sm:p-6" aria-labelledby="create-workspace">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--action-primary-bg)] text-[var(--action-primary-ink)]"><Plus className="h-5 w-5" aria-hidden="true" /></div>
            <h2 id="create-workspace" className="mt-5 text-xl font-semibold">Create church organization</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Start a workspace for your worship and production team. Default service preparation settings will be added automatically.</p>
            <form className="mt-6 space-y-4" onSubmit={createWorkspace}>
              <div>
                <label htmlFor="workspace-name" className="ui-technical-label">CHURCH ORGANIZATION NAME</label>
                <input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Angeles City Bible Church" className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border-default)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" required minLength={2} maxLength={120} />
              </div>
              {error ? <p className="text-sm text-[var(--text-danger)]" role="alert">{error}</p> : null}
              <button type="submit" disabled={creating} className="ui-btn-primary pressable inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                {creating ? "Creating workspace…" : "Create workspace"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

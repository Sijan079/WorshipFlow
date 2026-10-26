"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MoreHorizontal, Pencil, Plus, RefreshCcw, UsersRound, X, Archive, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProductionSelect } from "@/components/ui/production-select";
import { PAPToastViewport, usePAPToasts } from "@/features/pap/components/pap-toasts";
import { MINISTRIES_QUERY_KEY, PEOPLE_QUERY_KEY, createMinistry, fetchMinistries, fetchPeople, updateMinistry } from "@/features/people/people-api";
import type { MinistryRecord } from "./ministry-types";

const GRID = "grid-cols-[minmax(0,1fr)_44px] min-[1200px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(90px,.5fr)_minmax(100px,.5fr)_44px]";
const LABEL_CLASS = "mb-1 block text-sm font-medium text-[var(--text-secondary)]";

function MinistryDialog({
  ministry,
  canEdit,
  pending,
  onClose,
  onSave,
}: {
  ministry: MinistryRecord | null;
  canEdit: boolean;
  pending: boolean;
  onClose: () => void;
  onSave: (patch: { label: string; leaderId: string | null }) => void;
}) {
  const [label, setLabel] = useState(ministry?.label ?? "");
  const [leaderId, setLeaderId] = useState(ministry?.leaderId ?? "");
  const [error, setError] = useState("");
  const membersQuery = useQuery({
    queryKey: [...PEOPLE_QUERY_KEY, "ministry-members", ministry?.id],
    queryFn: () => fetchPeople({ search: "", status: "all", ministryId: ministry?.id ?? "" }),
    enabled: Boolean(ministry),
  });
  const members = membersQuery.data?.items ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">{ministry ? "Edit ministry" : "Add ministry"}</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[var(--text-secondary)]">
              {ministry ? "Change who belongs to a ministry from the People page." : "Give the ministry a name. You can choose members afterward."}
            </DialogDescription>
          </div>
          <button type="button" onClick={onClose} className="ui-modal-close pressable" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          className="mt-5 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!label.trim()) return setError("Ministry name is required.");
            onSave({ label: label.trim(), leaderId: leaderId || null });
          }}
        >
          <label className="block">
            <span className={LABEL_CLASS}>Name</span>
            <input type="text" value={label} onChange={(event) => setLabel(event.target.value)} className="ui-field ui-field-inactive w-full px-3 py-2 outline-none" autoFocus disabled={!canEdit} />
            {error ? <p className="mt-1 text-sm text-[var(--state-danger)]" role="alert">{error}</p> : null}
          </label>
          {ministry ? (
            <>
              <ProductionSelect
                label="Leader"
                labelClassName={LABEL_CLASS}
                value={leaderId}
                onValueChange={setLeaderId}
                disabled={!canEdit}
                options={[{ value: "", label: membersQuery.isLoading ? "Loading…" : members.length === 0 ? "No members yet" : "No leader" }, ...members.map((member) => ({ value: member.id, label: `${member.firstName} ${member.lastName}` }))]}
              />
              <div>
                <p className={LABEL_CLASS}>Members ({members.length})</p>
                {membersQuery.isLoading ? (
                  <p className="text-sm text-[var(--text-secondary)]">Loading members…</p>
                ) : members.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">No one belongs to this ministry yet.</p>
                ) : (
                  <ul className="max-h-48 divide-y divide-[var(--rule-default)] overflow-y-auto rounded-md border border-[var(--border-default)]">
                    {members.map((member) => (
                      <li key={member.id} className="px-3 py-2 text-sm text-[var(--text-primary)]">{member.firstName} {member.lastName}</li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : null}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="ui-btn-cancel pressable min-h-11 px-4 text-sm font-semibold">Cancel</button>
            {canEdit ? (
              <button type="submit" disabled={pending} className="ui-btn-primary pressable inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {ministry ? "Save changes" : "Add ministry"}
              </button>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MinistriesPageClient() {
  const queryClient = useQueryClient();
  const { dismissToast, showToast, toasts } = usePAPToasts();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<MinistryRecord | "new" | null>(null);

  const query = useQuery({ queryKey: MINISTRIES_QUERY_KEY, queryFn: fetchMinistries });
  const canEdit = query.data?.permissions.canEdit ?? false;
  const all = query.data?.items ?? [];
  const items = showArchived ? all : all.filter((ministry) => ministry.active);

  // Resolves once the lists have reloaded, so a finished action never shows a stale list.
  function refresh() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: MINISTRIES_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEY }),
    ]);
  }

  const saveMutation = useMutation({
    mutationFn: ({ ministry, patch }: { ministry: MinistryRecord | null; patch: { label: string; leaderId: string | null } }) =>
      ministry ? updateMinistry(ministry.id, patch) : createMinistry(patch.label),
    onSuccess: async (_result, { ministry }) => {
      await refresh();
      setEditing(null);
      showToast(ministry ? "Changes saved." : "Ministry added.", "success");
    },
    onError: (error: Error) => showToast(error.message || "Could not save this ministry. Try again.", "error"),
  });

  const activeMutation = useMutation({
    mutationFn: ({ ministry, active }: { ministry: MinistryRecord; active: boolean }) => updateMinistry(ministry.id, { active }),
    onSuccess: async (_result, { ministry, active }) => {
      await refresh();
      showToast(active ? `${ministry.label} was restored.` : `${ministry.label} was archived.`, "success");
    },
    onError: (error: Error) => showToast(error.message || "Could not update this ministry.", "error"),
  });

  return (
    <div className="ministries-page min-h-full space-y-6 py-1 lg:px-2">
      <section className="ui-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="ui-page-title">Ministries</h1>
          <p className="ui-page-description">The groups your people belong to and serve in, such as Youth, Music, or Church Leaders.</p>
        </div>
        {canEdit ? (
          <button type="button" onClick={() => setEditing("new")} className="ui-btn-primary pressable inline-flex min-h-11 items-center justify-center gap-2 self-start px-4 py-2.5 text-sm font-semibold sm:self-auto">
            <Plus className="h-4 w-4" />
            Add ministry
          </button>
        ) : null}
      </section>

      <section className="ui-surface-elevated ui-operational-register">
        <div className="ui-register-toolbar">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex min-h-10 items-center gap-3 text-sm text-[var(--text-primary)]">
              <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="ui-checkbox h-5 w-5" />
              Show archived ministries
            </label>
            <div className="flex items-center gap-3">
              <p className="text-sm leading-6 text-[var(--text-secondary)] md:text-base">{items.length} {items.length === 1 ? "ministry" : "ministries"}</p>
              <button type="button" onClick={() => void query.refetch()} className="pressable inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-accent)]" aria-label="Refresh ministries">
                <RefreshCcw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {query.isLoading ? (
          <div role="status" aria-label="Loading ministries" className="divide-y divide-[var(--rule-default)]">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="px-4 py-4"><div className="h-4 w-40 animate-pulse rounded bg-[var(--surface-panel-strong)]" /></div>
            ))}
          </div>
        ) : query.isError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-y border-[var(--state-danger)] bg-[var(--state-danger-soft)] px-4 py-4 text-sm text-[var(--text-primary)]">
            <p>Ministries could not be loaded.</p>
            <button type="button" onClick={() => void query.refetch()} className="ui-btn-secondary pressable min-h-10 px-3 text-sm font-semibold">Try again</button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
            <UsersRound className="h-8 w-8 text-[var(--text-muted)]" />
            <h2 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">No ministries yet</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">{canEdit ? "Add a ministry to start grouping your people." : "Ask an administrator to add ministries."}</p>
          </div>
        ) : (
          <div>
            <div aria-hidden="true" className={`ui-ledger-header hidden items-center gap-3 px-4 py-2.5 min-[1200px]:grid ${GRID}`}>
              <span>Ministry</span>
              <span>Leader</span>
              <span>Members</span>
              <span>Status</span>
              <span />
            </div>
            <ul>
              {items.map((ministry) => (
                <li key={ministry.id} className="group ui-ledger-row">
                  <div className={`grid items-center gap-3 px-4 py-4 ${GRID}`}>
                    <div className="min-w-0">
                      <button type="button" onClick={() => setEditing(ministry)} className="block max-w-full truncate text-left text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)]">
                        {ministry.label}
                      </button>
                      <p className="mt-1 truncate text-sm text-[var(--text-secondary)] min-[1200px]:hidden">
                        {ministry.leaderName ? `Led by ${ministry.leaderName} · ` : ""}{ministry.memberCount} {ministry.memberCount === 1 ? "member" : "members"}{ministry.active ? "" : " · Archived"}
                      </p>
                    </div>
                    <p className="hidden truncate text-sm text-[var(--text-secondary)] min-[1200px]:block">{ministry.leaderName ?? "—"}</p>
                    <p className="hidden text-sm text-[var(--text-secondary)] min-[1200px]:block">{ministry.memberCount}</p>
                    <p className="hidden text-sm text-[var(--text-secondary)] min-[1200px]:block">{ministry.active ? "Active" : "Archived"}</p>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="ui-row-menu-trigger ui-row-menu-trigger-edge" aria-label={`Actions for ${ministry.label}`} title={`Actions for ${ministry.label}`}>
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="left" sideOffset={8} className="workspace-content-light ui-action-menu-content w-48">
                        <DropdownMenuItem onSelect={() => setEditing(ministry)} className="ui-action-menu-item gap-2 px-2">
                          <Pencil className="h-4 w-4" />
                          {canEdit ? "Edit" : "View"}
                        </DropdownMenuItem>
                        {canEdit ? (
                          <DropdownMenuItem onSelect={() => activeMutation.mutate({ ministry, active: !ministry.active })} className="ui-action-menu-item gap-2 px-2">
                            {ministry.active ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                            {ministry.active ? "Archive" : "Restore"}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {editing ? (
        <MinistryDialog
          ministry={editing === "new" ? null : editing}
          canEdit={canEdit}
          pending={saveMutation.isPending}
          onClose={() => setEditing(null)}
          onSave={(patch) => saveMutation.mutate({ ministry: editing === "new" ? null : editing, patch })}
        />
      ) : null}

      <PAPToastViewport toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
}

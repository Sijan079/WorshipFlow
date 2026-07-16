"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { ChevronDown, GripVertical, Loader2, Plus, Redo2, RefreshCcw, Save, Trash2, Undo2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  apiFetch,
  type ActivateChecklistPresetPayload,
  type ChecklistPresetRecord,
  type CreateChecklistPresetPayload,
  type CreateEditableSettingsPresetPayload,
  type CreateServiceTemplatePresetPayload,
  type CreateSongTagPresetPayload,
  type EditableSettingsPresetRecord,
  type ServiceTemplatePresetRecord,
  type SongTagPresetRecord,
  type UpdateChecklistPresetPayload,
  type UpdateEditableSettingsPresetPayload,
  type UpdateServiceTemplatePresetPayload,
  type UpdateSongTagPresetPayload,
} from "@/lib/api-client";
import { moveTemplateBlock, normalizePresetCode } from "@/lib/settings-presets";
import type { EnvironmentReport } from "@/lib/server-env";

type EditableEndpoint = "ministries" | "servant-groups";

type EditableForm = {
  label: string;
  code: string;
  active: boolean;
};

type ChecklistItemForm = {
  id?: string;
  label: string;
  active: boolean;
};

type ChecklistForm = { name: string; items: ChecklistItemForm[] };

type TemplateBlockForm = {
  id: string;
  label: string;
  code?: string;
  blockType?: string;
};

type TemplateForm = {
  label: string;
  code: string;
  templateType: ServiceTemplatePresetRecord["templateType"];
  optionalBlocks: string[];
  blocks: TemplateBlockForm[];
};

type TemplateHistory = {
  past: TemplateForm[];
  future: TemplateForm[];
};

type SongTagForm = {
  label: string;
  token: string;
  color: string;
};

const SETTINGS_TABS = [
  { id: "general", label: "General" },
  { id: "templates", label: "Templates" },
  { id: "tags", label: "Tags" },
  { id: "checklist", label: "Checklist" },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

const EMPTY_EDITABLE_FORM: EditableForm = { label: "", code: "", active: true };
const EMPTY_TEMPLATE_FORM: TemplateForm = {
  label: "",
  code: "",
  templateType: "REGULAR",
  optionalBlocks: [],
  blocks: [
    { id: "new-call-to-worship", label: "Call to Worship" },
    { id: "new-praise-and-worship", label: "Praise & Worship" },
    { id: "new-sermon", label: "Sermon" },
  ],
};
const EMPTY_SONG_TAG_FORM: SongTagForm = { label: "", token: "", color: "#CFE8F6" };

function StatusPill({
  active,
  activeLabel = "Active",
  inactiveLabel = "Inactive",
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-1 font-[var(--font-mono)] text-[10px] font-bold uppercase ${
      active ? "bg-[var(--state-success-soft)] text-[var(--text-success)]" : "bg-[var(--surface-panel-alt)] text-[var(--text-secondary)]"
    }`}>
      <span className={`status-pip ${active ? "status-pip-ready" : "status-pip-idle"}`} />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

function SettingsAddButton({
  controls,
  disabled,
  expanded,
  label,
  onClick,
}: {
  controls: string;
  disabled?: boolean;
  expanded: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`pressable inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${expanded ? "border-[var(--action-primary-bg-hover)] bg-[var(--action-primary-bg)] text-[var(--action-primary-ink)] hover:bg-[var(--action-primary-bg-hover)]" : "border-[var(--border-default)] bg-[var(--surface-panel-strong)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-panel-elevated)] hover:text-[var(--text-primary)]"}`}
      aria-controls={controls}
      aria-expanded={expanded}
    >
      {expanded ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      <span>{expanded ? "Close" : label}</span>
    </button>
  );
}

function SectionSaveButton({ disabled, onClick, pending }: { disabled: boolean; onClick: () => void; pending: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || pending} className="ui-btn-primary pressable inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      <span>Save changes</span>
    </button>
  );
}

function SettingsEmptyState({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-[var(--text-secondary)]">{children}</div>;
}

function DeleteConfirmDialog({
  description,
  label,
  onCancel,
  onConfirm,
  pending,
}: {
  description: string;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onCancel(); }}>
      <DialogContent className="ui-modal max-w-md p-5">
        <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Delete {label}?</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={pending} className="pressable h-10 rounded-md px-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--action-ghost-hover)] hover:text-[var(--text-primary)] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={pending} className="ui-btn-danger pressable h-10 px-3 text-sm font-semibold disabled:opacity-50">{pending ? "Deleting..." : "Delete"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionShell({
  action,
  children,
  pending,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  pending?: boolean;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          {pending ? <Loader2 className="h-4 w-4 animate-spin text-[var(--text-secondary)]" /> : null}
        </div>
        {action}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function CollectionState({
  children,
  error,
  isLoading,
  label,
  onRetry,
}: {
  children: ReactNode;
  error: unknown;
  isLoading: boolean;
  label: string;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-4 py-10 text-center text-sm text-[var(--text-secondary)]">
        Loading {label.toLowerCase()}...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--state-danger)] bg-[var(--state-danger-soft)] px-4 py-3 text-sm text-[var(--text-danger)]">
        <span><strong>{label}:</strong> {error instanceof Error ? error.message : "Failed to load settings"}</span>
        <button type="button" onClick={onRetry} className="ui-btn-secondary pressable px-3 py-1.5 text-xs font-semibold">
          Retry
        </button>
      </div>
    );
  }

  return children;
}

function GeneralStatus({ environment }: { environment: EnvironmentReport }) {
  return (
    <section aria-labelledby="operational-status-heading" className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4">
      <div className="border-b border-[var(--border-default)] pb-3">
        <h2 id="operational-status-heading" className="text-base font-semibold text-[var(--text-primary)]">Operational Status</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Safe workspace and AI availability signals. Credentials are never displayed.</p>
      </div>
      <div className="grid gap-4 pt-4 md:grid-cols-3">
        <div>
          <p className="technical-label">AI USAGE</p>
          <p className="mt-2 font-semibold text-[var(--text-primary)]">Not available</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">Provider balances are not inferred from generation estimates.</p>
        </div>
        <div>
          <p className="technical-label">ACCESS CONTROL</p>
          <p className="mt-2 font-semibold text-[var(--text-primary)]">{environment.accessGate ? "Shared access enabled" : "Not configured"}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">Individual accounts and managed access remain deferred to 1.2.</p>
        </div>
        <div>
          <p className="technical-label">AI INTEGRATIONS</p>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-secondary)]">Lyrics cleanup</dt>
              <dd className="font-semibold text-[var(--text-primary)]">{environment.aiExtractor ? "Configured" : "Unavailable"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-secondary)]">Background generation</dt>
              <dd className="font-semibold text-[var(--text-primary)]">{environment.backgroundGeneration ? "Configured" : "Unavailable"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function EditablePresetSection({
  endpoint,
  records,
  title,
}: {
  endpoint: EditableEndpoint;
  records: EditableSettingsPresetRecord[];
  title: string;
}) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, EditableForm>>({});
  const [newRecord, setNewRecord] = useState<EditableForm>(EMPTY_EDITABLE_FORM);
  const [newRecordOpen, setNewRecordOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<EditableSettingsPresetRecord | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: CreateEditableSettingsPresetPayload) =>
      apiFetch<EditableSettingsPresetRecord>(`/api/settings/${endpoint}`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", endpoint] });
      setNewRecord(EMPTY_EDITABLE_FORM);
      setNewRecordOpen(false);
    },
  });
  const updateMutation = useMutation({
    mutationFn: (entries: Array<[string, UpdateEditableSettingsPresetPayload]>) => Promise.all(entries.map(([id, payload]) =>
      apiFetch<EditableSettingsPresetRecord>(`/api/settings/${endpoint}/${id}`, { method: "PUT", body: JSON.stringify(payload) })
    )),
    onSuccess: async () => {
      setDrafts({});
      await queryClient.invalidateQueries({ queryKey: ["settings", endpoint] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/api/settings/${endpoint}/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setDeleteCandidate(null);
      await queryClient.invalidateQueries({ queryKey: ["settings", endpoint] });
    },
  });
  const changedEntries = records.flatMap((record) => {
    const draft = drafts[record.id];
    return draft && (draft.label !== record.label || draft.active !== record.active)
      ? [[record.id, draft] as [string, UpdateEditableSettingsPresetPayload]]
      : [];
  });
  const invalidDraft = changedEntries.some(([, draft]) => !draft.label?.trim());

  return (
    <>
    <SectionShell
      title={title}
      pending={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
      action={<div className="flex items-center gap-2">
        {changedEntries.length > 0 ? <SectionSaveButton disabled={invalidDraft} pending={updateMutation.isPending} onClick={() => updateMutation.mutate(changedEntries)} /> : null}
        <SettingsAddButton controls={`${endpoint}-new-record`} expanded={newRecordOpen} label={endpoint === "ministries" ? "Add ministry" : "Add servant group"} onClick={() => { if (newRecordOpen) setNewRecord(EMPTY_EDITABLE_FORM); setNewRecordOpen((open) => !open); }} disabled={createMutation.isPending} />
      </div>}
    >
      {newRecordOpen ? <div id={`${endpoint}-new-record`} className="grid gap-3 border-b border-[var(--border-default)] bg-[var(--surface-panel-alt)] p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
        <input value={newRecord.label} onChange={(event) => setNewRecord({ ...newRecord, label: event.target.value, code: newRecord.code || normalizePresetCode(event.target.value) })} className="rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]" placeholder="Label" autoFocus />
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]"><input type="checkbox" checked={newRecord.active} onChange={(event) => setNewRecord({ ...newRecord, active: event.target.checked })} className="ui-checkbox h-4 w-4" />Active</label>
        <button type="button" onClick={() => createMutation.mutate(newRecord)} disabled={createMutation.isPending || !newRecord.label.trim() || !newRecord.code.trim()} className="ui-btn-primary pressable h-10 px-3 text-sm font-semibold disabled:opacity-40">{createMutation.isPending ? "Adding..." : "Add"}</button>
      </div> : null}
      <div className="min-w-[32rem] space-y-3 p-4">
          {records.length === 0 ? <SettingsEmptyState>No saved records yet. Use the add action above.</SettingsEmptyState> : null}
          {records.map((record, index) => {
            const draft = drafts[record.id] ?? record;
            return (
              <div key={record.id} className="group grid min-h-12 grid-cols-[2rem_minmax(0,1fr)_7rem_2.75rem] overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] transition-[border-color,box-shadow] hover:border-[color:color-mix(in_oklab,var(--border-focus)_42%,var(--border-default))] focus-within:border-[var(--border-focus)] focus-within:shadow-[0_0_0_1px_var(--border-focus)]">
                <span className="flex items-center justify-center border-r border-[var(--border-default)] bg-[var(--surface-panel-alt)] font-[var(--font-mono)] text-[10px] font-semibold text-[var(--text-muted)]" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <input
                  value={draft.label}
                  onChange={(event) => setDrafts({ ...drafts, [record.id]: { ...draft, label: event.target.value } })}
                  className="min-w-0 border-0 bg-transparent px-3 py-2 text-sm font-medium text-[var(--text-primary)] shadow-none outline-none"
                  aria-label={`${record.label} label`}
                />
                <button type="button" onClick={() => setDrafts({ ...drafts, [record.id]: { ...draft, active: !draft.active } })} className="flex items-center justify-center border-l border-[var(--border-default)] px-2" aria-label={`${draft.active ? "Deactivate" : "Activate"} ${record.label}`}>
                    <StatusPill active={draft.active} />
                </button>
                {record.isDefault ? <span className="border-l border-[var(--border-default)]" aria-hidden="true" /> : <button type="button" onClick={() => setDeleteCandidate(record)} className="pressable inline-flex min-h-11 w-full items-center justify-center border-l border-[var(--border-default)] bg-transparent text-[var(--text-muted)] hover:bg-[var(--state-danger-soft)] hover:text-[var(--text-danger)]" aria-label={`Delete ${record.label}`} title={`Delete ${record.label}`}><Trash2 className="h-3.5 w-3.5" /><span className="sr-only">Delete {record.label}</span></button>}
              </div>
            );
          })}
      </div>
    </SectionShell>
    {deleteCandidate ? (
      <DeleteConfirmDialog
        label={deleteCandidate.label}
        description={`${deleteCandidate.label} will be permanently removed from ${title.toLowerCase()}.`}
        pending={deleteMutation.isPending}
        onCancel={() => setDeleteCandidate(null)}
        onConfirm={() => deleteMutation.mutate(deleteCandidate.id)}
      />
    ) : null}
    </>
  );
}

function ChecklistSection({ records }: { records: ChecklistPresetRecord[] }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, ChecklistForm>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newChecklistOpen, setNewChecklistOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [draggedItem, setDraggedItem] = useState<{ checklistId: string; index: number } | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<ChecklistPresetRecord | null>(null);
  const queryKey = ["settings", "checklists"];

  function toForm(record: ChecklistPresetRecord): ChecklistForm {
    return {
      name: record.name,
      items: record.items.map((item) => ({ id: item.id, label: item.label, active: item.active })),
    };
  }

  function getDraft(record: ChecklistPresetRecord) {
    return drafts[record.id] ?? toForm(record);
  }

  function setDraft(id: string, draft: ChecklistForm) {
    setDrafts((current) => ({ ...current, [id]: draft }));
  }

  function isDirty(record: ChecklistPresetRecord, draft: ChecklistForm) {
    return JSON.stringify(draft) !== JSON.stringify(toForm(record));
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateChecklistPresetPayload) =>
      apiFetch<ChecklistPresetRecord>("/api/settings/checklists", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async (record) => {
      await queryClient.invalidateQueries({ queryKey });
      setNewName("");
      setNewChecklistOpen(false);
      setExpanded((current) => ({ ...current, [record.id]: true }));
    },
  });
  const updateMutation = useMutation({
    mutationFn: (entries: Array<[string, UpdateChecklistPresetPayload]>) => Promise.all(entries.map(([id, payload]) =>
      apiFetch<ChecklistPresetRecord>(`/api/settings/checklists/${id}`, { method: "PUT", body: JSON.stringify(payload) })
    )),
    onSuccess: async () => {
      setDrafts({});
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const activateMutation = useMutation({
    mutationFn: (payload: ActivateChecklistPresetPayload) =>
      apiFetch<{ checklistId: string }>("/api/settings/checklists", { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/api/settings/checklists/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setDeleteCandidate(null);
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const changedEntries = records.flatMap((record) => {
    const draft = drafts[record.id];
    return draft && isDirty(record, draft) ? [[record.id, draft] as [string, UpdateChecklistPresetPayload]] : [];
  });
  const invalidDraft = changedEntries.some(([, draft]) => !draft.name.trim() || draft.items.some((item) => !item.label.trim()));

  return (
    <>
      <SectionShell
        title="Checklist Sets"
        pending={createMutation.isPending || updateMutation.isPending || activateMutation.isPending || deleteMutation.isPending}
        action={<div className="flex items-center gap-2">
          {changedEntries.length > 0 ? <SectionSaveButton disabled={invalidDraft} pending={updateMutation.isPending} onClick={() => updateMutation.mutate(changedEntries)} /> : null}
          <SettingsAddButton
            controls="new-checklist-form"
            disabled={createMutation.isPending}
            expanded={newChecklistOpen}
            label="Add checklist"
            onClick={() => {
              if (newChecklistOpen) setNewName("");
              setNewChecklistOpen((open) => !open);
            }}
          />
        </div>}
      >
        <div className="divide-y divide-[var(--border-default)]">
          {newChecklistOpen ? (
            <div id="new-checklist-form" className="grid gap-3 bg-[var(--surface-panel-alt)] px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Checklist name" autoFocus className="rounded-md border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]" />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setNewChecklistOpen(false); setNewName(""); }} className="ui-btn-secondary pressable px-3 py-2 text-xs font-semibold">Cancel</button>
                <button type="button" onClick={() => createMutation.mutate({ name: newName })} disabled={!newName.trim() || createMutation.isPending} className="ui-btn-primary pressable px-3 py-2 text-xs font-semibold disabled:opacity-50">
                  {createMutation.isPending ? "Creating..." : "Create Checklist"}
                </button>
              </div>
            </div>
          ) : null}

          {records.length === 0 && !newChecklistOpen ? <SettingsEmptyState>No checklist sets yet. Use Add checklist to create one.</SettingsEmptyState> : null}

          {records.map((record) => {
            const draft = getDraft(record);
            const open = expanded[record.id] ?? record.isActive;
            return (
              <article key={record.id} className={record.isActive ? "production-stripe bg-[var(--surface-panel-alt)]" : ""}>
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button type="button" onClick={() => setExpanded((current) => ({ ...current, [record.id]: !open }))} aria-expanded={open} className="pressable flex min-w-0 flex-1 items-center gap-3 text-left">
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-secondary)] ${open ? "rotate-180" : ""}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{record.name}</span>
                      <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{record.items.length} {record.items.length === 1 ? "item" : "items"}</span>
                    </span>
                  </button>
                  {record.isActive ? (
                    <StatusPill active activeLabel="On dashboard" />
                  ) : (
                    <button type="button" onClick={() => activateMutation.mutate({ checklistId: record.id })} disabled={activateMutation.isPending} className="ui-btn-secondary pressable px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Show on dashboard</button>
                  )}
                  {!record.isDefault && !record.isActive ? (
                    <button type="button" onClick={() => setDeleteCandidate(record)} className="pressable inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-destructive)] hover:bg-[var(--state-danger-soft)]" aria-label={`Delete ${record.name}`} title="Delete checklist"><Trash2 className="h-4 w-4" /></button>
                  ) : null}
                </div>

                <div className="ui-collapse" data-open={open}>
                  <div>
                    <div className="space-y-4 border-t border-[var(--border-default)] px-4 py-4">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                          Checklist name
                          <input value={draft.name} onChange={(event) => setDraft(record.id, { ...draft, name: event.target.value })} className="mt-1.5 w-full rounded-md border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]" />
                        </label>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Checklist items</h3>
                        <button type="button" onClick={() => setDraft(record.id, { ...draft, items: [...draft.items, { label: "", active: true }] })} className="ui-btn-secondary pressable inline-flex h-10 items-center gap-2 px-3 text-xs font-semibold"><Plus className="h-3.5 w-3.5" /> Add item</button>
                      </div>
                      <div className="min-w-[34rem] space-y-3">
                        {draft.items.map((item, index) => (
                          <div key={item.id ?? `new-${index}`} draggable onDragStart={() => setDraggedItem({ checklistId: record.id, index })} onDragOver={(event) => event.preventDefault()} onDrop={() => {
                            if (draggedItem?.checklistId === record.id) setDraft(record.id, { ...draft, items: moveTemplateBlock(draft.items, draggedItem.index, index) });
                            setDraggedItem(null);
                          }} className="group grid min-h-12 grid-cols-[2rem_2.75rem_minmax(12rem,1fr)_6rem_2.75rem] overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] transition-[border-color,opacity,box-shadow] hover:border-[color:color-mix(in_oklab,var(--border-focus)_42%,var(--border-default))] focus-within:border-[var(--border-focus)] focus-within:shadow-[0_0_0_1px_var(--border-focus)]">
                            <span className="flex items-center justify-center border-r border-[var(--border-default)] bg-[var(--surface-panel-alt)] font-[var(--font-mono)] text-[10px] font-semibold text-[var(--text-muted)]">{String(index + 1).padStart(2, "0")}</span>
                            <button type="button" onKeyDown={(event) => {
                              const target = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : index;
                              if (target === index || target < 0 || target >= draft.items.length) return;
                              event.preventDefault();
                              setDraft(record.id, { ...draft, items: moveTemplateBlock(draft.items, index, target) });
                            }} className="flex items-center justify-center border-r border-[var(--border-default)] bg-[var(--surface-panel-strong)] text-[var(--text-muted)] hover:bg-[var(--surface-panel-elevated)] hover:text-[var(--text-primary)]" aria-label={`Reorder item ${index + 1}`} title="Drag or use arrow keys"><GripVertical className="h-4 w-4" /></button>
                            <input value={item.label} onChange={(event) => setDraft(record.id, { ...draft, items: draft.items.map((candidate, itemIndex) => itemIndex === index ? { ...candidate, label: event.target.value } : candidate) })} placeholder="Checklist item" className="min-w-0 border-0 bg-transparent px-3 py-2 text-sm font-medium text-[var(--text-primary)] shadow-none outline-none" />
                            <label className="flex items-center justify-center border-l border-[var(--border-default)]" title={item.active ? "Enabled" : "Disabled"}>
                              <input type="checkbox" checked={item.active} onChange={(event) => setDraft(record.id, { ...draft, items: draft.items.map((candidate, itemIndex) => itemIndex === index ? { ...candidate, active: event.target.checked } : candidate) })} className="ui-checkbox h-4 w-4" aria-label={`${item.active ? "Disable" : "Enable"} item ${index + 1}`} />
                            </label>
                            <button type="button" onClick={() => setDraft(record.id, { ...draft, items: draft.items.filter((_, itemIndex) => itemIndex !== index) })} className="pressable flex items-center justify-center border-l border-[var(--border-default)] text-[var(--text-muted)] hover:bg-[var(--state-danger-soft)] hover:text-[var(--text-danger)]" aria-label={`Delete item ${index + 1}`}><Trash2 className="h-3.5 w-3.5" /><span className="sr-only">Delete</span></button>
                          </div>
                        ))}
                        {draft.items.length === 0 ? <SettingsEmptyState>No checklist items yet. Use Add item above.</SettingsEmptyState> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </SectionShell>

      {deleteCandidate ? (
        <DeleteConfirmDialog
          label={deleteCandidate.name}
          description={`${deleteCandidate.name} will be permanently removed.`}
          pending={deleteMutation.isPending}
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={() => deleteMutation.mutate(deleteCandidate.id)}
        />
      ) : null}
    </>
  );
}

function ServiceTemplateSection({ records }: { records: ServiceTemplatePresetRecord[] }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, TemplateForm>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<{ templateId: string; index: number } | null>(null);
  const [draftHistory, setDraftHistory] = useState<Record<string, TemplateHistory>>({});
  const [saveState, setSaveState] = useState<Record<string, "saving" | "saved" | "error">>({});
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [newRecord, setNewRecord] = useState<TemplateForm>(EMPTY_TEMPLATE_FORM);
  const [newHistory, setNewHistory] = useState<TemplateHistory>({ past: [], future: [] });
  const endpoint = "service-templates";
  const selectedRecords = records.filter((record) => selectedIds.includes(record.id));

  function toTemplateForm(record: ServiceTemplatePresetRecord): TemplateForm {
    return {
      label: record.label,
      code: record.code,
      templateType: record.templateType,
      optionalBlocks: record.optionalBlocks,
      blocks: record.blocks.length > 0
        ? record.blocks.map((block, index) => ({
            id: `${record.id}-${block.code || index}`,
            label: block.label,
            code: block.code,
            blockType: block.blockType,
          }))
        : [{ id: `${record.id}-fallback`, label: record.label }],
    };
  }

  function toTemplatePayload(form: TemplateForm): CreateServiceTemplatePresetPayload {
    const blocks = form.blocks
      .map((block, order) => ({
        label: block.label.trim(),
        code: block.code,
        blockType: block.blockType,
        order,
      }))
      .filter((block) => block.label.length > 0);

    return {
      label: form.label.trim(),
      code: form.code || normalizePresetCode(form.label),
      active: true,
      templateType: form.templateType,
      optionalBlocks: form.optionalBlocks,
      blocks,
    };
  }

  function updateBlock(form: TemplateForm, index: number, label: string) {
    return {
      ...form,
      blocks: form.blocks.map((block, blockIndex) => blockIndex === index ? { ...block, label } : block),
    };
  }

  function removeBlock(form: TemplateForm, index: number) {
    const blocks = form.blocks.filter((_, blockIndex) => blockIndex !== index);
    return {
      ...form,
      blocks: blocks.length > 0 ? blocks : [{ id: crypto.randomUUID(), label: "" }],
    };
  }

  function setDraft(id: string, form: TemplateForm) {
    const record = records.find((candidate) => candidate.id === id);
    const previous = drafts[id] ?? (record ? toTemplateForm(record) : form);
    if (JSON.stringify(previous) === JSON.stringify(form)) return;
    setDraftHistory((current) => ({
      ...current,
      [id]: {
        past: [...(current[id]?.past ?? []), previous].slice(-50),
        future: [],
      },
    }));
    setDrafts((current) => ({ ...current, [id]: form }));
    setSaveState((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function undoDraft(id: string, currentForm: TemplateForm) {
    const history = draftHistory[id];
    const previous = history?.past.at(-1);
    if (!history || !previous) return;
    setDrafts((current) => ({ ...current, [id]: previous }));
    setDraftHistory((current) => ({
      ...current,
      [id]: { past: history.past.slice(0, -1), future: [currentForm, ...history.future] },
    }));
    setSaveState((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setReorderAnnouncement("Undid the last template change.");
  }

  function redoDraft(id: string, currentForm: TemplateForm) {
    const history = draftHistory[id];
    const nextForm = history?.future[0];
    if (!history || !nextForm) return;
    setDrafts((current) => ({ ...current, [id]: nextForm }));
    setDraftHistory((current) => ({
      ...current,
      [id]: { past: [...history.past, currentForm], future: history.future.slice(1) },
    }));
    setSaveState((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setReorderAnnouncement("Redid the last template change.");
  }

  function setNewDraft(form: TemplateForm) {
    if (JSON.stringify(newRecord) === JSON.stringify(form)) return;
    setNewHistory((current) => ({ past: [...current.past, newRecord].slice(-50), future: [] }));
    setNewRecord(form);
  }

  function undoNewDraft() {
    const previous = newHistory.past.at(-1);
    if (!previous) return;
    setNewRecord(previous);
    setNewHistory({ past: newHistory.past.slice(0, -1), future: [newRecord, ...newHistory.future] });
    setReorderAnnouncement("Undid the last new template change.");
  }

  function redoNewDraft() {
    const nextForm = newHistory.future[0];
    if (!nextForm) return;
    setNewRecord(nextForm);
    setNewHistory({ past: [...newHistory.past, newRecord], future: newHistory.future.slice(1) });
    setReorderAnnouncement("Redid the last new template change.");
  }

  function announceMove(block: TemplateBlockForm, target: number, total: number) {
    setReorderAnnouncement(`${block.label || "Block"} moved to position ${target + 1} of ${total}.`);
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateServiceTemplatePresetPayload) =>
      apiFetch<ServiceTemplatePresetRecord>(`/api/settings/${endpoint}`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", endpoint] });
      setNewRecord(EMPTY_TEMPLATE_FORM);
      setNewHistory({ past: [], future: [] });
      setNewTemplateOpen(false);
    },
  });
  const updateMutation = useMutation({
    mutationFn: (entries: Array<{ id: string; payload: UpdateServiceTemplatePresetPayload }>) => Promise.all(entries.map(({ id, payload }) =>
      apiFetch<ServiceTemplatePresetRecord>(`/api/settings/${endpoint}/${id}`, { method: "PUT", body: JSON.stringify(payload) })
    )),
    onMutate: (entries) => setSaveState((current) => ({ ...current, ...Object.fromEntries(entries.map(({ id }) => [id, "saving" as const])) })),
    onSuccess: async (_, entries) => {
      await queryClient.invalidateQueries({ queryKey: ["settings", endpoint] });
      setDrafts((current) => {
        const next = { ...current };
        entries.forEach(({ id }) => delete next[id]);
        return next;
      });
      setDraftHistory((current) => {
        const next = { ...current };
        entries.forEach(({ id }) => delete next[id]);
        return next;
      });
      setSaveState((current) => ({ ...current, ...Object.fromEntries(entries.map(({ id }) => [id, "saved" as const])) }));
    },
    onError: (_, entries) => setSaveState((current) => ({ ...current, ...Object.fromEntries(entries.map(({ id }) => [id, "error" as const])) })),
  });
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => apiFetch<{ success: boolean }>(`/api/settings/${endpoint}/${id}`, { method: "DELETE" })),
      );
      return {
        failedIds: ids.filter((_, index) => results[index].status === "rejected"),
      };
    },
    onSuccess: async ({ failedIds }) => {
      await queryClient.invalidateQueries({ queryKey: ["settings", endpoint] });
      setSelectedIds(failedIds);
      setDeleteConfirmOpen(false);
      setDeleteError(
        failedIds.length > 0
          ? `${failedIds.length} selected template${failedIds.length === 1 ? "" : "s"} could not be deleted. The failed selection has been retained.`
          : null,
      );
    },
  });
  const changedTemplateEntries = records.flatMap((record) => {
    const draft = drafts[record.id];
    return draft && JSON.stringify(toTemplatePayload(draft)) !== JSON.stringify(toTemplatePayload(toTemplateForm(record)))
      ? [{ id: record.id, payload: toTemplatePayload(draft) }]
      : [];
  });
  const invalidTemplateDraft = changedTemplateEntries.some(({ payload }) => !payload.label || payload.blocks.length === 0);

  return (
    <>
    <SectionShell
      title="Service Templates"
      pending={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
      action={(
        <div className="flex items-center gap-2">
          {changedTemplateEntries.length > 0 ? <SectionSaveButton disabled={invalidTemplateDraft} pending={updateMutation.isPending} onClick={() => updateMutation.mutate(changedTemplateEntries)} /> : null}
          {selectedIds.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setDeleteConfirmOpen(true);
              }}
              disabled={deleteMutation.isPending}
              className="ui-btn-danger pressable inline-flex h-10 min-w-10 items-center justify-center gap-2 px-3 hover:bg-[var(--state-danger-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Delete selected templates"
              title="Delete selected templates"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden text-sm font-semibold sm:inline">Delete ({selectedIds.length})</span>
            </button>
          ) : null}
          <SettingsAddButton
            controls="new-template-details"
            expanded={newTemplateOpen}
            label="Add template"
            onClick={() => {
              if (newTemplateOpen) {
                setNewRecord(EMPTY_TEMPLATE_FORM);
                setNewHistory({ past: [], future: [] });
              }
              setNewTemplateOpen((open) => !open);
            }}
            disabled={createMutation.isPending}
          />
        </div>
      )}
    >
      <p className="sr-only" aria-live="polite">{reorderAnnouncement}</p>
      <div className="divide-y divide-[var(--border-default)]">
        {deleteError ? (
          <div role="alert" className="bg-[var(--state-danger-soft)] px-4 py-3 text-sm text-[var(--text-danger)]">
            {deleteError}
          </div>
        ) : null}
        {records.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="font-semibold text-[var(--text-primary)]">No service templates</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Use the add action above to create the first template.</p>
          </div>
        ) : null}
        {records.map((record) => {
          const savedForm = toTemplateForm(record);
          const draft = drafts[record.id] ?? savedForm;
          const isOpen = Boolean(expanded[record.id]);
          const isSelected = selectedIds.includes(record.id);
          const isDirty = JSON.stringify(toTemplatePayload(draft)) !== JSON.stringify(toTemplatePayload(savedForm));
          const currentSaveState = saveState[record.id];
          const history = draftHistory[record.id];
          const saveLabel = currentSaveState === "saving"
            ? "Saving…"
            : currentSaveState === "error"
              ? "Save failed"
              : "Unsaved changes";
          const panelId = `template-details-${record.id}`;

          return (
            <article key={record.id}>
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-panel-strong)]">
                <label className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(event) => {
                      setDeleteError(null);
                      setSelectedIds((current) => event.target.checked
                        ? [...current, record.id]
                        : current.filter((id) => id !== record.id));
                    }}
                    className="ui-checkbox h-5 w-5"
                    aria-label={`Select ${record.label}`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setExpanded((current) => ({ ...current, [record.id]: !isOpen }))}
                  className="pressable flex min-h-11 min-w-0 flex-1 items-center justify-between gap-4 text-left"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[var(--text-primary)]">{draft.label || record.label}</span>
                    <span className="block text-xs text-[var(--text-secondary)]">
                      {draft.blocks.filter((block) => block.label.trim()).length} blocks{isDirty ? " · Unsaved" : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <StatusPill active={record.active} />
                    <ChevronDown className={`h-4 w-4 text-[var(--text-secondary)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </span>
                </button>
              </div>

              {isOpen ? (
                <div id={panelId} className="animate-fade-in bg-[var(--surface-canvas)] px-4 py-5 sm:px-6">
                  <div className="mx-auto w-full max-w-5xl space-y-5">
                    <section className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)]">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3">
                        <div>
                          <p className="technical-label">TEMPLATE DETAILS</p>
                          <p className="mt-1 text-xs text-[var(--text-secondary)]">The template name appears as a service type on the Services page.</p>
                        </div>
                        {isDirty || currentSaveState === "saving" || currentSaveState === "error" ? (
                          <span
                            className={`inline-flex min-h-7 items-center gap-2 rounded px-2.5 py-1 font-[var(--font-mono)] text-[11px] font-semibold uppercase tracking-wide ${currentSaveState === "error" ? "bg-[var(--state-danger-soft)] text-[var(--text-danger)]" : "bg-[color:color-mix(in_oklab,var(--action-primary-bg)_22%,var(--surface-panel-strong))] text-[var(--text-accent)]"}`}
                            role={currentSaveState === "error" ? "alert" : "status"}
                          >
                            {currentSaveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className={`h-2 w-2 rounded-full ${currentSaveState === "error" ? "bg-[var(--state-danger)]" : "bg-[var(--action-primary-bg)]"}`} />}
                            {saveLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="p-4">
                        <label className="block space-y-1.5 text-sm font-semibold text-[var(--text-secondary)]">
                          <span>Template name</span>
                          <input
                            value={draft.label}
                            onChange={(event) => setDraft(record.id, { ...draft, label: event.target.value })}
                            className="h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                          />
                        </label>
                      </div>
                    </section>

                    <section className="space-y-3" aria-label="Program block order">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Program blocks</h3>
                            <span className="rounded bg-[var(--surface-panel-strong)] px-2 py-0.5 font-[var(--font-mono)] text-[10px] font-semibold text-[var(--text-secondary)]">{draft.blocks.length}</span>
                          </div>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">Drag to reorder, or focus a handle and use the arrow keys.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)]">
                            <button
                              type="button"
                              onClick={() => undoDraft(record.id, draft)}
                              disabled={!history?.past.length}
                              className="pressable inline-flex h-11 w-11 items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35"
                              aria-label="Undo last template change"
                              title="Undo"
                            >
                              <Undo2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => redoDraft(record.id, draft)}
                              disabled={!history?.future.length}
                              className="pressable inline-flex h-11 w-11 items-center justify-center border-l border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35"
                              aria-label="Redo last template change"
                              title="Redo"
                            >
                              <Redo2 className="h-4 w-4" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDraft(record.id, { ...draft, blocks: [...draft.blocks, { id: crypto.randomUUID(), label: "" }] })}
                            className="pressable inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-strong)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--action-primary-bg-hover)] hover:bg-[var(--action-primary-bg)] hover:text-[var(--action-primary-ink)] active:bg-[var(--action-primary-bg-hover)]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add block</span>
                          </button>
                        </div>
                      </div>
                      {draft.blocks.map((block, index) => (
                        <div
                          key={block.id}
                          className={`group grid min-h-12 grid-cols-[2rem_2.75rem_minmax(0,1fr)_2.75rem] overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] transition-[border-color,opacity,box-shadow] hover:border-[color:color-mix(in_oklab,var(--border-focus)_42%,var(--border-default))] focus-within:border-[var(--border-focus)] focus-within:shadow-[0_0_0_1px_var(--border-focus)] ${draggedBlock?.templateId === record.id && draggedBlock.index === index ? "opacity-60" : ""}`}
                          onDragOver={(event) => {
                            if (!draggedBlock || draggedBlock.templateId !== record.id) return;
                            event.preventDefault();
                            if (draggedBlock.index === index) return;
                            setDraft(record.id, { ...draft, blocks: moveTemplateBlock(draft.blocks, draggedBlock.index, index) });
                            setDraggedBlock({ templateId: record.id, index });
                          }}
                          onDrop={() => setDraggedBlock(null)}
                        >
                          <span className="flex items-center justify-center border-r border-[var(--border-default)] bg-[var(--surface-panel-alt)] font-[var(--font-mono)] text-[10px] font-semibold text-[var(--text-muted)]" aria-hidden="true">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <button
                            type="button"
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", String(index));
                              setDraggedBlock({ templateId: record.id, index });
                            }}
                            onDragEnd={() => setDraggedBlock(null)}
                            onKeyDown={(event) => {
                              const target = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : index;
                              if (target === index || target < 0 || target >= draft.blocks.length) return;
                              event.preventDefault();
                              setDraft(record.id, { ...draft, blocks: moveTemplateBlock(draft.blocks, index, target) });
                              announceMove(block, target, draft.blocks.length);
                            }}
                            className="inline-flex min-h-11 w-11 shrink-0 cursor-grab items-center justify-center border-r border-[var(--border-default)] bg-[var(--surface-panel-strong)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel-elevated)] hover:text-[var(--text-primary)] active:cursor-grabbing"
                            aria-label={`Reorder ${block.label || `block ${index + 1}`}`}
                            title="Drag to reorder. Use arrow keys for keyboard reordering."
                          >
                            <GripVertical className="h-4 w-4" />
                            <span className="sr-only">Reorder</span>
                          </button>
                          <input
                            value={block.label}
                            onChange={(event) => setDraft(record.id, updateBlock(draft, index, event.target.value))}
                            className="min-w-0 border-0 bg-transparent px-3 py-2 text-sm font-medium text-[var(--text-primary)] shadow-none outline-none focus:z-10"
                            aria-label={`Program block ${index + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => setDraft(record.id, removeBlock(draft, index))}
                            className="pressable inline-flex min-h-11 w-11 shrink-0 items-center justify-center border-l border-[var(--border-default)] bg-transparent text-[var(--text-muted)] hover:bg-[var(--state-danger-soft)] hover:text-[var(--text-danger)]"
                            aria-label={`Remove block ${index + 1}`}
                            title="Remove block"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Remove</span>
                          </button>
                        </div>
                      ))}
                    </section>

                  </div>
                </div>
              ) : null}
            </article>
          );
        })}

        {newTemplateOpen ? (
          <article>
            <div id="new-template-details" className="animate-fade-in bg-[var(--surface-canvas)] px-4 py-5 sm:px-6">
              <div className="mx-auto w-full max-w-5xl space-y-5">
                <section className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)]">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3">
                    <div>
                      <p className="technical-label">NEW TEMPLATE</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">This template becomes a service type on the Services page.</p>
                    </div>
                    <span className="rounded bg-[var(--surface-panel-strong)] px-2.5 py-1 font-[var(--font-mono)] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Draft</span>
                  </div>
                  <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <label className="block space-y-1.5 text-sm font-semibold text-[var(--text-secondary)]">
                      <span>Template name</span>
                      <input
                        value={newRecord.label}
                        onChange={(event) => setNewDraft({ ...newRecord, label: event.target.value, code: newRecord.code || normalizePresetCode(event.target.value) })}
                        className="h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                        placeholder="Template name"
                      />
                    </label>
                    <button type="button" onClick={() => createMutation.mutate(toTemplatePayload(newRecord))} disabled={createMutation.isPending || !newRecord.label.trim() || newRecord.blocks.every((block) => !block.label.trim())} className="ui-btn-primary pressable inline-flex h-11 w-full items-center justify-center gap-2 px-5 text-sm font-semibold disabled:opacity-50 lg:w-auto">
                      {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      <span>Create template</span>
                    </button>
                    {createMutation.isError ? <span role="alert" className="text-sm text-[var(--text-danger)] lg:col-span-2">Template could not be created. Try again.</span> : null}
                  </div>
                </section>

                <section className="space-y-3" aria-label="New template program block order">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Program blocks</h3>
                        <span className="rounded bg-[var(--surface-panel-strong)] px-2 py-0.5 font-[var(--font-mono)] text-[10px] font-semibold text-[var(--text-secondary)]">{newRecord.blocks.length}</span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">Set the order copied into every service created from this template.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)]">
                        <button type="button" onClick={undoNewDraft} disabled={!newHistory.past.length} className="pressable inline-flex h-11 w-11 items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35" aria-label="Undo last new template change" title="Undo">
                          <Undo2 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={redoNewDraft} disabled={!newHistory.future.length} className="pressable inline-flex h-11 w-11 items-center justify-center border-l border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35" aria-label="Redo last new template change" title="Redo">
                          <Redo2 className="h-4 w-4" />
                        </button>
                      </div>
                      <button type="button" onClick={() => setNewDraft({ ...newRecord, blocks: [...newRecord.blocks, { id: crypto.randomUUID(), label: "" }] })} className="pressable inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-strong)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--action-primary-bg-hover)] hover:bg-[var(--action-primary-bg)] hover:text-[var(--action-primary-ink)] active:bg-[var(--action-primary-bg-hover)]">
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add block</span>
                      </button>
                    </div>
                  </div>
                  {newRecord.blocks.map((block, index) => (
                    <div
                      key={block.id}
                      className={`group grid min-h-12 grid-cols-[2rem_2.75rem_minmax(0,1fr)_2.75rem] overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] transition-[border-color,opacity,box-shadow] hover:border-[color:color-mix(in_oklab,var(--border-focus)_42%,var(--border-default))] focus-within:border-[var(--border-focus)] focus-within:shadow-[0_0_0_1px_var(--border-focus)] ${draggedBlock?.templateId === "new" && draggedBlock.index === index ? "opacity-60" : ""}`}
                      onDragOver={(event) => {
                        if (!draggedBlock || draggedBlock.templateId !== "new") return;
                        event.preventDefault();
                        if (draggedBlock.index === index) return;
                        setNewDraft({ ...newRecord, blocks: moveTemplateBlock(newRecord.blocks, draggedBlock.index, index) });
                        setDraggedBlock({ templateId: "new", index });
                      }}
                      onDrop={() => setDraggedBlock(null)}
                    >
                      <span className="flex items-center justify-center border-r border-[var(--border-default)] bg-[var(--surface-panel-alt)] font-[var(--font-mono)] text-[10px] font-semibold text-[var(--text-muted)]" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", String(index));
                          setDraggedBlock({ templateId: "new", index });
                        }}
                        onDragEnd={() => setDraggedBlock(null)}
                        onKeyDown={(event) => {
                          const target = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : index;
                          if (target === index || target < 0 || target >= newRecord.blocks.length) return;
                          event.preventDefault();
                          setNewDraft({ ...newRecord, blocks: moveTemplateBlock(newRecord.blocks, index, target) });
                          announceMove(block, target, newRecord.blocks.length);
                        }}
                        className="inline-flex min-h-11 w-11 shrink-0 cursor-grab items-center justify-center border-r border-[var(--border-default)] bg-[var(--surface-panel-strong)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel-elevated)] hover:text-[var(--text-primary)] active:cursor-grabbing"
                        aria-label={`Reorder ${block.label || `block ${index + 1}`}`}
                        title="Drag to reorder. Use arrow keys for keyboard reordering."
                      >
                        <GripVertical className="h-4 w-4" />
                        <span className="sr-only">Reorder</span>
                      </button>
                      <input
                        value={block.label}
                        onChange={(event) => setNewDraft(updateBlock(newRecord, index, event.target.value))}
                        className="min-w-0 border-0 bg-transparent px-3 py-2 text-sm font-medium text-[var(--text-primary)] shadow-none outline-none focus:z-10"
                        placeholder="Program block"
                        aria-label={`New block ${index + 1}`}
                      />
                      <button type="button" onClick={() => setNewDraft(removeBlock(newRecord, index))} className="pressable inline-flex min-h-11 w-11 shrink-0 items-center justify-center border-l border-[var(--border-default)] bg-transparent text-[var(--text-muted)] hover:bg-[var(--state-danger-soft)] hover:text-[var(--text-danger)]" aria-label={`Remove new block ${index + 1}`} title="Remove block">
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Remove</span>
                      </button>
                    </div>
                  ))}
                </section>
              </div>
            </div>
          </article>
        ) : null}
      </div>
    </SectionShell>
    <Dialog open={deleteConfirmOpen} onOpenChange={(open) => !deleteMutation.isPending && setDeleteConfirmOpen(open)}>
      {deleteConfirmOpen ? (
        <DialogContent className="max-w-md">
          <p className="technical-label">DELETE SELECTED</p>
          <DialogTitle className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
            Delete {selectedRecords.length} template{selectedRecords.length === 1 ? "" : "s"}?
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            New services will no longer be able to use these templates. Existing services will keep their copied program blocks.
          </DialogDescription>
          <ul className="mt-4 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-[var(--text-primary)]">
            {selectedRecords.map((record) => <li key={record.id}>{record.label}</li>)}
          </ul>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={() => setDeleteConfirmOpen(false)} disabled={deleteMutation.isPending} className="pressable h-11 rounded-md px-4 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--action-ghost-hover)] hover:text-[var(--text-primary)] disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={() => deleteMutation.mutate(selectedIds)} disabled={deleteMutation.isPending} className="ui-btn-danger pressable inline-flex h-11 items-center gap-2 px-4 text-sm font-semibold hover:bg-[var(--state-danger-soft)] disabled:cursor-not-allowed disabled:opacity-50">
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span>Delete selected</span>
            </button>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
    </>
  );
}

function SongTagsSection({ records }: { records: SongTagPresetRecord[] }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, SongTagForm>>({});
  const [newRecord, setNewRecord] = useState<SongTagForm>(EMPTY_SONG_TAG_FORM);
  const [newTagOpen, setNewTagOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<SongTagPresetRecord | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: CreateSongTagPresetPayload) =>
      apiFetch<SongTagPresetRecord>("/api/song-tags", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["song-tags"] });
      setNewRecord(EMPTY_SONG_TAG_FORM);
      setNewTagOpen(false);
    },
  });
  const updateMutation = useMutation({
    mutationFn: (entries: Array<[string, UpdateSongTagPresetPayload]>) =>
      Promise.all(entries.map(([id, payload]) =>
        apiFetch<SongTagPresetRecord>(`/api/song-tags/${id}`, { method: "PUT", body: JSON.stringify(payload) })
      )),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["song-tags"] });
      setDrafts({});
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/api/song-tags/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setDeleteCandidate(null);
      await queryClient.invalidateQueries({ queryKey: ["song-tags"] });
    },
  });
  const changedEntries = records.flatMap((record) => {
    const draft = drafts[record.id];
    return draft && (draft.label !== record.label || draft.color !== record.color)
      ? [[record.id, draft] as [string, UpdateSongTagPresetPayload]]
      : [];
  });
  const hasInvalidDraft = changedEntries.some(([, draft]) => !draft.label?.trim());
  const hasNewTag = Boolean(newRecord.label.trim());

  async function saveTagChanges() {
    await Promise.all([
      changedEntries.length > 0 ? updateMutation.mutateAsync(changedEntries) : Promise.resolve(),
      hasNewTag ? createMutation.mutateAsync(newRecord) : Promise.resolve(),
    ]);
  }

  return (
    <>
    <SectionShell
      title="Song Tags"
      pending={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
      action={(
        <div className="flex items-center gap-2">
          {changedEntries.length > 0 || hasNewTag ? (
            <button
              type="button"
              onClick={() => void saveTagChanges()}
              disabled={createMutation.isPending || updateMutation.isPending || hasInvalidDraft}
              className="pressable inline-flex h-10 items-center gap-2 rounded-md border border-[var(--action-primary-bg-hover)] bg-[var(--action-primary-bg)] px-4 text-sm font-semibold text-[var(--action-primary-ink)] hover:bg-[var(--action-primary-bg-hover)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Save changes</span>
            </button>
          ) : null}
          <SettingsAddButton
            controls="new-song-tag-row"
            expanded={newTagOpen}
            label="Add tag"
            onClick={() => {
              if (newTagOpen) setNewRecord(EMPTY_SONG_TAG_FORM);
              setNewTagOpen((open) => !open);
            }}
            disabled={createMutation.isPending}
          />
        </div>
      )}
    >
      <div className="min-w-[38rem] space-y-3 p-4">
        {records.length === 0 && !newTagOpen ? <SettingsEmptyState>No song tags yet. Use Add tag to create one.</SettingsEmptyState> : null}
        {records.map((record, index) => {
          const draft = drafts[record.id] ?? record;
          return (
            <div key={record.id} className="group grid min-h-12 grid-cols-[2rem_minmax(0,1fr)_7rem_2.75rem] overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] transition-[border-color,box-shadow] hover:border-[color:color-mix(in_oklab,var(--border-focus)_42%,var(--border-default))] focus-within:border-[var(--border-focus)] focus-within:shadow-[0_0_0_1px_var(--border-focus)]">
              <span className="flex items-center justify-center border-r border-[var(--border-default)] bg-[var(--surface-panel-alt)] font-[var(--font-mono)] text-[10px] font-semibold text-[var(--text-muted)]" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <input
                value={draft.label}
                onChange={(event) => setDrafts({ ...drafts, [record.id]: { ...draft, label: event.target.value } })}
                className="min-w-0 border-0 bg-transparent px-3 py-2 text-sm font-medium text-[var(--text-primary)] shadow-none outline-none"
                aria-label={`${record.label} label`}
              />
              <label className="block overflow-hidden border-l border-[var(--border-default)]">
                <input
                  type="color"
                  value={draft.color}
                  onChange={(event) => setDrafts({ ...drafts, [record.id]: { ...draft, color: event.target.value } })}
                  className="ui-color-cell h-full min-h-12 w-full"
                  aria-label={`${record.label} color`}
                />
              </label>
              {record.isDefault ? (
                <span className="border-l border-[var(--border-default)]" aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteCandidate(record)}
                  className="pressable inline-flex min-h-11 w-full items-center justify-center border-l border-[var(--border-default)] bg-transparent text-[var(--text-muted)] hover:bg-[var(--state-danger-soft)] hover:text-[var(--text-danger)]"
                  aria-label={`Delete ${record.label}`}
                  title="Delete tag"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Delete tag</span>
                </button>
              )}
            </div>
          );
        })}

        {newTagOpen ? (
          <div id="new-song-tag-row" className="grid min-h-12 grid-cols-[2rem_minmax(0,1fr)_7rem_2.75rem] overflow-hidden rounded-md border border-dashed border-[var(--border-default)] bg-[var(--surface-panel-alt)] focus-within:border-[var(--border-focus)] focus-within:shadow-[0_0_0_1px_var(--border-focus)]">
            <span className="flex items-center justify-center border-r border-[var(--border-default)] font-[var(--font-mono)] text-[10px] font-semibold text-[var(--text-muted)]" aria-hidden="true">
              {String(records.length + 1).padStart(2, "0")}
            </span>
            <input
              value={newRecord.label}
              onChange={(event) => setNewRecord({ ...newRecord, label: event.target.value, token: event.target.value })}
              className="min-w-0 border-0 bg-transparent px-3 py-2 text-sm font-medium text-[var(--text-primary)] shadow-none outline-none"
              placeholder="New tag label"
              aria-label="New tag label"
              autoFocus
            />
            <label className="block overflow-hidden border-l border-[var(--border-default)]">
              <input
                type="color"
                value={newRecord.color}
                onChange={(event) => setNewRecord({ ...newRecord, color: event.target.value })}
                className="ui-color-cell h-full min-h-12 w-full"
                aria-label="New tag color"
              />
            </label>
            <span className="border-l border-[var(--border-default)]" aria-hidden="true" />
          </div>
        ) : null}
      </div>
    </SectionShell>
    {deleteCandidate ? (
      <DeleteConfirmDialog
        label={deleteCandidate.label}
        description={`${deleteCandidate.label} will be permanently removed from song tags.`}
        pending={deleteMutation.isPending}
        onCancel={() => setDeleteCandidate(null)}
        onConfirm={() => deleteMutation.mutate(deleteCandidate.id)}
      />
    ) : null}
    </>
  );
}

export default function SettingsPageClient({ environment }: { environment: EnvironmentReport }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const syncTabFromUrl = () => {
      const tab = new URLSearchParams(window.location.search).get("tab");
      setActiveTab(SETTINGS_TABS.some((candidate) => candidate.id === tab) ? tab as SettingsTab : "general");
    };

    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, []);
  const ministriesQuery = useQuery({
    queryKey: ["settings", "ministries"],
    queryFn: () => apiFetch<EditableSettingsPresetRecord[]>("/api/settings/ministries"),
  });
  const servantGroupsQuery = useQuery({
    queryKey: ["settings", "servant-groups"],
    queryFn: () => apiFetch<EditableSettingsPresetRecord[]>("/api/settings/servant-groups"),
  });
  const checklistQuery = useQuery({
    queryKey: ["settings", "checklists"],
    queryFn: () => apiFetch<ChecklistPresetRecord[]>("/api/settings/checklists"),
  });
  const serviceTemplatesQuery = useQuery({
    queryKey: ["settings", "service-templates"],
    queryFn: () => apiFetch<ServiceTemplatePresetRecord[]>("/api/settings/service-templates"),
  });
  const songTagsQuery = useQuery({
    queryKey: ["song-tags"],
    queryFn: () => apiFetch<SongTagPresetRecord[]>("/api/song-tags"),
  });

  const queries = [ministriesQuery, servantGroupsQuery, checklistQuery, serviceTemplatesQuery, songTagsQuery];
  const isRefreshing = queries.some((query) => query.isFetching);

  function refreshAll() {
    void ministriesQuery.refetch();
    void servantGroupsQuery.refetch();
    void checklistQuery.refetch();
    void serviceTemplatesQuery.refetch();
    void songTagsQuery.refetch();
  }

  function selectTab(tab: SettingsTab) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "general") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.pushState(null, "", url);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % SETTINGS_TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = SETTINGS_TABS.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    selectTab(SETTINGS_TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-default)] pb-5">
        <div>
          <p className="technical-label">WORKSPACE CONTROL</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Settings</h1>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          disabled={isRefreshing}
          className="pressable inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel)] hover:text-[var(--text-primary)] disabled:opacity-60"
          aria-label="Refresh settings"
          title="Refresh"
        >
          {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        </button>
      </header>

      <div className="overflow-x-auto border-b border-[var(--border-default)]" role="tablist" aria-label="Settings sections">
        <div className="flex min-w-max gap-1">
          {SETTINGS_TABS.map((tab, index) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(element) => { tabRefs.current[index] = element; }}
                type="button"
                id={`settings-tab-${tab.id}`}
                role="tab"
                aria-controls={`settings-panel-${tab.id}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`pressable border-b-2 px-4 py-3 text-sm font-semibold ${selected ? "border-[var(--border-focus)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div id="settings-panel-general" role="tabpanel" aria-labelledby="settings-tab-general" tabIndex={0} hidden={activeTab !== "general"} className="space-y-5">
        <GeneralStatus environment={environment} />
        <CollectionState label="Ministries" isLoading={ministriesQuery.isLoading} error={ministriesQuery.error} onRetry={() => void ministriesQuery.refetch()}>
          <EditablePresetSection endpoint="ministries" title="Ministries" records={ministriesQuery.data ?? []} />
        </CollectionState>
        <CollectionState label="Servant groups" isLoading={servantGroupsQuery.isLoading} error={servantGroupsQuery.error} onRetry={() => void servantGroupsQuery.refetch()}>
          <EditablePresetSection endpoint="servant-groups" title="Servant Groups" records={servantGroupsQuery.data ?? []} />
        </CollectionState>
      </div>

      <div id="settings-panel-templates" role="tabpanel" aria-labelledby="settings-tab-templates" tabIndex={0} hidden={activeTab !== "templates"} className="space-y-5">
        <CollectionState label="Service templates" isLoading={serviceTemplatesQuery.isLoading} error={serviceTemplatesQuery.error} onRetry={() => void serviceTemplatesQuery.refetch()}>
          <ServiceTemplateSection records={serviceTemplatesQuery.data ?? []} />
        </CollectionState>
      </div>

      <div id="settings-panel-tags" role="tabpanel" aria-labelledby="settings-tab-tags" tabIndex={0} hidden={activeTab !== "tags"} className="space-y-5">
        <CollectionState label="Song tags" isLoading={songTagsQuery.isLoading} error={songTagsQuery.error} onRetry={() => void songTagsQuery.refetch()}>
          <SongTagsSection records={songTagsQuery.data ?? []} />
        </CollectionState>
      </div>

      <div id="settings-panel-checklist" role="tabpanel" aria-labelledby="settings-tab-checklist" tabIndex={0} hidden={activeTab !== "checklist"} className="space-y-5">
        <CollectionState label="Checklist sets" isLoading={checklistQuery.isLoading} error={checklistQuery.error} onRetry={() => void checklistQuery.refetch()}>
          <ChecklistSection records={checklistQuery.data ?? []} />
        </CollectionState>
      </div>
    </div>
  );
}

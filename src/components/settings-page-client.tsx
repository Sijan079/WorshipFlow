"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Loader2, Plus, RefreshCcw, Save, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiFetch,
  type ChecklistItemPresetRecord,
  type CreateChecklistItemPresetPayload,
  type CreateEditableSettingsPresetPayload,
  type CreateServiceTemplatePresetPayload,
  type CreateSongTagPresetPayload,
  type EditableSettingsPresetRecord,
  type ServiceTemplatePresetRecord,
  type SongTagPresetRecord,
  type UpdateChecklistItemPresetPayload,
  type UpdateEditableSettingsPresetPayload,
  type UpdateServiceTemplatePresetPayload,
  type UpdateSongTagPresetPayload,
} from "@/lib/api-client";
import { normalizePresetCode } from "@/lib/settings-presets";

type EditableEndpoint = "ministries" | "servant-groups";

type EditableForm = {
  label: string;
  code: string;
  active: boolean;
};

type ChecklistForm = {
  label: string;
  order: number;
  active: boolean;
};

type TemplateForm = EditableForm & {
  blocks: Array<{ label: string }>;
};

type SongTagForm = {
  label: string;
  token: string;
  color: string;
};

const EMPTY_EDITABLE_FORM: EditableForm = { label: "", code: "", active: true };
const EMPTY_CHECKLIST_FORM: ChecklistForm = { label: "", order: 0, active: true };
const EMPTY_TEMPLATE_FORM: TemplateForm = {
  label: "",
  code: "",
  active: true,
  blocks: [{ label: "Call to Worship" }, { label: "Praise & Worship" }, { label: "Sermon" }],
};
const EMPTY_SONG_TAG_FORM: SongTagForm = { label: "", token: "", color: "#CFE8F6" };

function nextOrder(records: Array<{ order: number }>) {
  return records.reduce((highest, record) => Math.max(highest, record.order), -1) + 1;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-1 font-[var(--font-mono)] text-[10px] font-bold uppercase ${
      active ? "bg-[var(--state-success-soft)] text-[var(--text-success)]" : "bg-[var(--surface-panel-alt)] text-[var(--text-secondary)]"
    }`}>
      <span className={`status-pip ${active ? "status-pip-ready" : "status-pip-idle"}`} />
      {active ? "Active" : "Inactive"}
    </span>
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

function SaveButton({ disabled, pending, onClick }: { disabled?: boolean; pending?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className="pressable inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)] disabled:opacity-50"
      aria-label="Save"
      title="Save"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
    </button>
  );
}

function DeleteButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="pressable inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--state-danger-soft)] hover:text-[var(--text-danger)] disabled:opacity-40"
      aria-label="Delete"
      title={disabled ? "Default records cannot be deleted" : "Delete"}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function AddEditableRow({
  form,
  onChange,
  onSubmit,
  pending,
}: {
  form: EditableForm;
  onChange: (form: EditableForm) => void;
  onSubmit: () => void;
  pending?: boolean;
}) {
  return (
    <tr className="border-t border-[var(--border-default)] bg-[var(--surface-panel-alt)]">
      <td className="min-w-48 px-4 py-3">
        <input
          value={form.label}
          onChange={(event) => onChange({ ...form, label: event.target.value, code: form.code || normalizePresetCode(event.target.value) })}
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          placeholder="Label"
        />
      </td>
      <td className="min-w-40 px-4 py-3">
        <input
          value={form.code}
          onChange={(event) => onChange({ ...form, code: normalizePresetCode(event.target.value) })}
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 font-[var(--font-mono)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          placeholder="CODE"
        />
      </td>
      <td className="w-28 px-4 py-3">
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
          <input type="checkbox" checked={form.active} onChange={(event) => onChange({ ...form, active: event.target.checked })} />
          Active
        </label>
      </td>
      <td className="w-24 px-4 py-3 text-right">
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending || !form.label.trim() || !form.code.trim()}
          className="pressable inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--action-primary-bg)] text-[var(--action-primary-ink)] disabled:opacity-50"
          aria-label="Add"
          title="Add"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </td>
    </tr>
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

  const createMutation = useMutation({
    mutationFn: (payload: CreateEditableSettingsPresetPayload) =>
      apiFetch<EditableSettingsPresetRecord>(`/api/settings/${endpoint}`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", endpoint] });
      setNewRecord(EMPTY_EDITABLE_FORM);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEditableSettingsPresetPayload }) =>
      apiFetch<EditableSettingsPresetRecord>(`/api/settings/${endpoint}/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["settings", endpoint] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/api/settings/${endpoint}/${id}`, { method: "DELETE" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["settings", endpoint] }),
  });

  return (
    <SectionShell title={title} pending={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}>
      <table className="min-w-full border-collapse">
        <thead className="bg-[var(--surface-panel-strong)] text-left text-xs font-semibold uppercase text-[var(--text-secondary)]">
          <tr>
            <th className="px-4 py-3">Label</th>
            <th className="px-4 py-3">Code</th>
            <th className="px-4 py-3">State</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const draft = drafts[record.id] ?? record;
            return (
              <tr key={record.id} className="border-t border-[var(--border-default)]">
                <td className="min-w-48 px-4 py-3">
                  <input
                    value={draft.label}
                    onChange={(event) => setDrafts({ ...drafts, [record.id]: { ...draft, label: event.target.value } })}
                    className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  />
                </td>
                <td className="min-w-40 px-4 py-3">
                  <input
                    value={draft.code}
                    onChange={(event) => setDrafts({ ...drafts, [record.id]: { ...draft, code: normalizePresetCode(event.target.value) } })}
                    className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 font-[var(--font-mono)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  />
                </td>
                <td className="w-32 px-4 py-3">
                  <button type="button" onClick={() => setDrafts({ ...drafts, [record.id]: { ...draft, active: !draft.active } })}>
                    <StatusPill active={draft.active} />
                  </button>
                </td>
                <td className="w-24 px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <SaveButton onClick={() => updateMutation.mutate({ id: record.id, payload: draft })} pending={updateMutation.isPending} />
                    <DeleteButton disabled={record.isDefault} onClick={() => deleteMutation.mutate(record.id)} />
                  </div>
                </td>
              </tr>
            );
          })}
          <AddEditableRow form={newRecord} onChange={setNewRecord} onSubmit={() => createMutation.mutate(newRecord)} pending={createMutation.isPending} />
        </tbody>
      </table>
    </SectionShell>
  );
}

function ChecklistSection({ records }: { records: ChecklistItemPresetRecord[] }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, ChecklistForm>>({});
  const [newRecord, setNewRecord] = useState<ChecklistForm>({ ...EMPTY_CHECKLIST_FORM, order: nextOrder(records) });
  const endpoint = "checklist-items";

  const createMutation = useMutation({
    mutationFn: (payload: CreateChecklistItemPresetPayload) =>
      apiFetch<ChecklistItemPresetRecord>(`/api/settings/${endpoint}`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", endpoint] });
      setNewRecord({ ...EMPTY_CHECKLIST_FORM, order: nextOrder(records) + 1 });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateChecklistItemPresetPayload }) =>
      apiFetch<ChecklistItemPresetRecord>(`/api/settings/${endpoint}/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["settings", endpoint] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/api/settings/${endpoint}/${id}`, { method: "DELETE" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["settings", endpoint] }),
  });

  return (
    <SectionShell title="Checklist Items" pending={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}>
      <table className="min-w-full border-collapse">
        <thead className="bg-[var(--surface-panel-strong)] text-left text-xs font-semibold uppercase text-[var(--text-secondary)]">
          <tr>
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">State</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const draft = drafts[record.id] ?? record;
            return (
              <tr key={record.id} className="border-t border-[var(--border-default)]">
                <td className="min-w-64 px-4 py-3">
                  <input
                    value={draft.label}
                    onChange={(event) => setDrafts({ ...drafts, [record.id]: { ...draft, label: event.target.value } })}
                    className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  />
                </td>
                <td className="w-32 px-4 py-3">
                  <button type="button" onClick={() => setDrafts({ ...drafts, [record.id]: { ...draft, active: !draft.active } })}>
                    <StatusPill active={draft.active} />
                  </button>
                </td>
                <td className="w-24 px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <SaveButton onClick={() => updateMutation.mutate({ id: record.id, payload: draft })} pending={updateMutation.isPending} />
                    <DeleteButton disabled={record.isDefault} onClick={() => deleteMutation.mutate(record.id)} />
                  </div>
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-[var(--border-default)] bg-[var(--surface-panel-alt)]">
            <td className="min-w-64 px-4 py-3">
              <input
                value={newRecord.label}
                onChange={(event) => setNewRecord({ ...newRecord, label: event.target.value })}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                placeholder="Checklist item"
              />
            </td>
            <td className="w-32 px-4 py-3">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                <input type="checkbox" checked={newRecord.active} onChange={(event) => setNewRecord({ ...newRecord, active: event.target.checked })} />
                Active
              </label>
            </td>
            <td className="w-24 px-4 py-3 text-right">
              <button
                type="button"
                onClick={() => createMutation.mutate(newRecord)}
                disabled={createMutation.isPending || !newRecord.label.trim()}
                className="pressable inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--action-primary-bg)] text-[var(--action-primary-ink)] disabled:opacity-50"
                aria-label="Add checklist item"
                title="Add"
              >
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </SectionShell>
  );
}

function ServiceTemplateSection({ records }: { records: ServiceTemplatePresetRecord[] }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, TemplateForm>>({});
  const [newRecord, setNewRecord] = useState<TemplateForm>(EMPTY_TEMPLATE_FORM);
  const endpoint = "service-templates";

  function toTemplateForm(record: ServiceTemplatePresetRecord): TemplateForm {
    return {
      label: record.label,
      code: record.code,
      active: record.active,
      blocks: record.blocks.length > 0 ? record.blocks.map((block) => ({ label: block.label })) : [{ label: record.label }],
    };
  }

  function toTemplatePayload(form: TemplateForm): CreateServiceTemplatePresetPayload {
    const blocks = form.blocks
      .map((block, order) => ({ label: block.label.trim(), order }))
      .filter((block) => block.label.length > 0);
    const hasExtendedCue = blocks.some((block) => /hymn|himno|tipan|pledge|covenant/i.test(block.label));

    return {
      label: form.label.trim(),
      code: form.code || normalizePresetCode(form.label),
      active: form.active,
      templateType: hasExtendedCue ? "FIRST_SUNDAY" : "REGULAR",
      optionalBlocks: [],
      blocks,
    };
  }

  function updateBlock(form: TemplateForm, index: number, label: string) {
    return {
      ...form,
      blocks: form.blocks.map((block, blockIndex) => blockIndex === index ? { label } : block),
    };
  }

  function removeBlock(form: TemplateForm, index: number) {
    const blocks = form.blocks.filter((_, blockIndex) => blockIndex !== index);
    return {
      ...form,
      blocks: blocks.length > 0 ? blocks : [{ label: "" }],
    };
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateServiceTemplatePresetPayload) =>
      apiFetch<ServiceTemplatePresetRecord>(`/api/settings/${endpoint}`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", endpoint] });
      setNewRecord(EMPTY_TEMPLATE_FORM);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateServiceTemplatePresetPayload }) =>
      apiFetch<ServiceTemplatePresetRecord>(`/api/settings/${endpoint}/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["settings", endpoint] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/api/settings/${endpoint}/${id}`, { method: "DELETE" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["settings", endpoint] }),
  });

  return (
    <SectionShell title="Service Templates" pending={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}>
      <table className="min-w-full border-collapse">
        <thead className="bg-[var(--surface-panel-strong)] text-left text-xs font-semibold uppercase text-[var(--text-secondary)]">
          <tr>
            <th className="px-4 py-3">Template</th>
            <th className="px-4 py-3">Program Blocks</th>
            <th className="px-4 py-3">Show</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const draft = drafts[record.id] ?? toTemplateForm(record);
            return (
              <tr key={record.id} className="border-t border-[var(--border-default)] align-top">
                <td className="min-w-48 px-4 py-3">
                  <input value={draft.label} onChange={(event) => setDrafts({ ...drafts, [record.id]: { ...draft, label: event.target.value } })} className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]" />
                </td>
                <td className="min-w-[340px] px-4 py-3">
                  <div className="space-y-2">
                    {draft.blocks.map((block, index) => (
                      <div key={`${record.id}-${index}`} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2">
                        <span className="font-[var(--font-mono)] text-xs text-[var(--text-secondary)]">{index + 1}</span>
                        <input
                          value={block.label}
                          onChange={(event) => setDrafts({ ...drafts, [record.id]: updateBlock(draft, index, event.target.value) })}
                          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                        />
                        <button
                          type="button"
                          onClick={() => setDrafts({ ...drafts, [record.id]: removeBlock(draft, index) })}
                          className="pressable inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)]"
                          aria-label="Remove block"
                          title="Remove block"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setDrafts({ ...drafts, [record.id]: { ...draft, blocks: [...draft.blocks, { label: "" }] } })}
                      className="pressable inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)]"
                      aria-label="Add block"
                      title="Add block"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
                <td className="w-32 px-4 py-3">
                  <button type="button" onClick={() => setDrafts({ ...drafts, [record.id]: { ...draft, active: !draft.active } })}>
                    <StatusPill active={draft.active} />
                  </button>
                </td>
                <td className="w-24 px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <SaveButton onClick={() => updateMutation.mutate({ id: record.id, payload: toTemplatePayload(draft) })} pending={updateMutation.isPending} />
                    <DeleteButton disabled={record.isDefault} onClick={() => deleteMutation.mutate(record.id)} />
                  </div>
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-[var(--border-default)] bg-[var(--surface-panel-alt)] align-top">
            <td className="min-w-48 px-4 py-3">
              <input value={newRecord.label} onChange={(event) => setNewRecord({ ...newRecord, label: event.target.value, code: newRecord.code || normalizePresetCode(event.target.value) })} className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]" placeholder="Template label" />
            </td>
            <td className="min-w-[340px] px-4 py-3">
              <div className="space-y-2">
                {newRecord.blocks.map((block, index) => (
                  <div key={`new-${index}`} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2">
                    <span className="font-[var(--font-mono)] text-xs text-[var(--text-secondary)]">{index + 1}</span>
                    <input
                      value={block.label}
                      onChange={(event) => setNewRecord(updateBlock(newRecord, index, event.target.value))}
                      className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                      placeholder="Program block"
                    />
                    <button
                      type="button"
                      onClick={() => setNewRecord(removeBlock(newRecord, index))}
                      className="pressable inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)]"
                      aria-label="Remove block"
                      title="Remove block"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setNewRecord({ ...newRecord, blocks: [...newRecord.blocks, { label: "" }] })}
                  className="pressable inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)]"
                  aria-label="Add block"
                  title="Add block"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </td>
            <td className="w-32 px-4 py-3">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                <input type="checkbox" checked={newRecord.active} onChange={(event) => setNewRecord({ ...newRecord, active: event.target.checked })} />
                Show
              </label>
            </td>
            <td className="w-24 px-4 py-3 text-right">
              <button type="button" onClick={() => createMutation.mutate(toTemplatePayload(newRecord))} disabled={createMutation.isPending || !newRecord.label.trim() || newRecord.blocks.every((block) => !block.label.trim())} className="pressable inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--action-primary-bg)] text-[var(--action-primary-ink)] disabled:opacity-50" aria-label="Add service template" title="Add">
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </SectionShell>
  );
}

function SongTagsSection({ records }: { records: SongTagPresetRecord[] }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, SongTagForm>>({});
  const [newRecord, setNewRecord] = useState<SongTagForm>(EMPTY_SONG_TAG_FORM);

  const createMutation = useMutation({
    mutationFn: (payload: CreateSongTagPresetPayload) =>
      apiFetch<SongTagPresetRecord>("/api/song-tags", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["song-tags"] });
      setNewRecord(EMPTY_SONG_TAG_FORM);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSongTagPresetPayload }) =>
      apiFetch<SongTagPresetRecord>(`/api/song-tags/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["song-tags"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/api/song-tags/${id}`, { method: "DELETE" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["song-tags"] }),
  });

  return (
    <SectionShell title="Song Tags" pending={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}>
      <table className="min-w-full border-collapse">
        <thead className="bg-[var(--surface-panel-strong)] text-left text-xs font-semibold uppercase text-[var(--text-secondary)]">
          <tr>
            <th className="px-4 py-3">Label</th>
            <th className="px-4 py-3">Token</th>
            <th className="px-4 py-3">Color</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const draft = drafts[record.id] ?? record;
            return (
              <tr key={record.id} className="border-t border-[var(--border-default)]">
                <td className="min-w-48 px-4 py-3">
                  <input value={draft.label} onChange={(event) => setDrafts({ ...drafts, [record.id]: { ...draft, label: event.target.value } })} className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]" />
                </td>
                <td className="min-w-40 px-4 py-3">
                  <input value={draft.token} onChange={(event) => setDrafts({ ...drafts, [record.id]: { ...draft, token: event.target.value } })} className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 font-[var(--font-mono)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]" />
                </td>
                <td className="w-24 px-4 py-3">
                  <input type="color" value={draft.color} onChange={(event) => setDrafts({ ...drafts, [record.id]: { ...draft, color: event.target.value } })} className="h-8 w-14 rounded border border-[var(--border-default)] bg-[var(--surface-panel-alt)]" aria-label={`${record.label} color`} />
                </td>
                <td className="w-24 px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <SaveButton onClick={() => updateMutation.mutate({ id: record.id, payload: draft })} pending={updateMutation.isPending} />
                    <DeleteButton disabled={record.isDefault} onClick={() => deleteMutation.mutate(record.id)} />
                  </div>
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-[var(--border-default)] bg-[var(--surface-panel-alt)]">
            <td className="min-w-48 px-4 py-3">
              <input value={newRecord.label} onChange={(event) => setNewRecord({ ...newRecord, label: event.target.value, token: newRecord.token || event.target.value })} className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]" placeholder="Tag label" />
            </td>
            <td className="min-w-40 px-4 py-3">
              <input value={newRecord.token} onChange={(event) => setNewRecord({ ...newRecord, token: event.target.value })} className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 font-[var(--font-mono)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]" placeholder="Token" />
            </td>
            <td className="w-24 px-4 py-3">
              <input type="color" value={newRecord.color} onChange={(event) => setNewRecord({ ...newRecord, color: event.target.value })} className="h-8 w-14 rounded border border-[var(--border-default)] bg-[var(--surface-panel)]" aria-label="New tag color" />
            </td>
            <td className="w-24 px-4 py-3 text-right">
              <button type="button" onClick={() => createMutation.mutate(newRecord)} disabled={createMutation.isPending || !newRecord.label.trim() || !newRecord.token.trim()} className="pressable inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--action-primary-bg)] text-[var(--action-primary-ink)] disabled:opacity-50" aria-label="Add song tag" title="Add">
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </SectionShell>
  );
}

export default function SettingsPageClient() {
  const ministriesQuery = useQuery({
    queryKey: ["settings", "ministries"],
    queryFn: () => apiFetch<EditableSettingsPresetRecord[]>("/api/settings/ministries"),
  });
  const servantGroupsQuery = useQuery({
    queryKey: ["settings", "servant-groups"],
    queryFn: () => apiFetch<EditableSettingsPresetRecord[]>("/api/settings/servant-groups"),
  });
  const checklistQuery = useQuery({
    queryKey: ["settings", "checklist-items"],
    queryFn: () => apiFetch<ChecklistItemPresetRecord[]>("/api/settings/checklist-items"),
  });
  const serviceTemplatesQuery = useQuery({
    queryKey: ["settings", "service-templates"],
    queryFn: () => apiFetch<ServiceTemplatePresetRecord[]>("/api/settings/service-templates"),
  });
  const songTagsQuery = useQuery({
    queryKey: ["song-tags"],
    queryFn: () => apiFetch<SongTagPresetRecord[]>("/api/song-tags"),
  });

  const queries = useMemo(
    () => [ministriesQuery, servantGroupsQuery, checklistQuery, serviceTemplatesQuery, songTagsQuery],
    [ministriesQuery, servantGroupsQuery, checklistQuery, serviceTemplatesQuery, songTagsQuery],
  );
  const isLoading = queries.some((query) => query.isLoading);
  const isRefreshing = queries.some((query) => query.isFetching);
  const error = queries.find((query) => query.error)?.error;

  function refreshAll() {
    void ministriesQuery.refetch();
    void servantGroupsQuery.refetch();
    void checklistQuery.refetch();
    void serviceTemplatesQuery.refetch();
    void songTagsQuery.refetch();
  }

  return (
    <main className="space-y-5">
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

      {error ? (
        <div className="rounded-lg border border-[var(--state-danger-border)] bg-[var(--state-danger-soft)] px-4 py-3 text-sm text-[var(--text-danger)]">
          {error instanceof Error ? error.message : "Failed to load settings"}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-4 py-10 text-center text-sm text-[var(--text-secondary)]">
          Loading settings...
        </div>
      ) : (
        <div className="space-y-5">
          <ServiceTemplateSection records={serviceTemplatesQuery.data ?? []} />
          <EditablePresetSection endpoint="ministries" title="Ministries" records={ministriesQuery.data ?? []} />
          <EditablePresetSection endpoint="servant-groups" title="Servant Groups" records={servantGroupsQuery.data ?? []} />
          <SongTagsSection records={songTagsQuery.data ?? []} />
          <ChecklistSection records={checklistQuery.data ?? []} />
        </div>
      )}
    </main>
  );
}

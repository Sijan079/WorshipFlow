"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCcw, Search, Settings2, Trash2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiFetch,
  type CreateServantPayload,
  type EditableSettingsPresetRecord,
  type ServantRecord,
  type UpdateServantPayload,
} from "@/lib/api-client";
import {
  formatServantGenderLabel,
  formatServantGroupLabel,
  SERVANT_GENDER_OPTIONS,
  SERVANT_GROUP_OPTIONS,
  type NullableServantGender,
  type ServantGender,
  type ServantGroup,
} from "@/lib/servants";

type ServantFormState = CreateServantPayload;
type ServantFormErrors = Partial<Record<keyof ServantFormState, string>>;
type BulkAssignFormState = {
  gender: ServantGender | "" | "null";
  groupCode: string | "";
};

type GroupOption = {
  value: string;
  label: string;
  legacyGroup: ServantGroup | null;
};

const EMPTY_FORM: ServantFormState = {
  name: "",
  gender: null,
  group: null,
  groupCode: null,
};

function buildGroupOptions(records: EditableSettingsPresetRecord[] = []): GroupOption[] {
  if (records.length > 0) {
    return records.filter((record) => record.active).map((record) => ({
      value: record.code,
      label: record.label,
      legacyGroup: SERVANT_GROUP_OPTIONS.some((option) => option.value === record.code)
        ? (record.code as ServantGroup)
        : null,
    }));
  }

  return SERVANT_GROUP_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    legacyGroup: option.value,
  }));
}

function getGroupLabel(servant: ServantRecord, groupOptions: GroupOption[]) {
  return groupOptions.find((option) => option.value === servant.groupCode)?.label
    ?? formatServantGroupLabel(servant.group);
}

function validateServantForm(form: ServantFormState): ServantFormErrors {
  const errors: ServantFormErrors = {};

  if (!form.name.trim()) {
    errors.name = "Servant name is required";
  }

  return errors;
}

function TeamsTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead className="bg-[var(--color-brand-panel-strong)]">
          <tr className="text-left">
            <th className="w-12 px-4 py-3" />
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Name</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Gender</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Group</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, index) => (
            <tr key={`team-skeleton-${index}`} className="border-t border-[var(--color-brand-border)] bg-[var(--color-brand-panel)]">
              <td className="px-4 py-4 align-top">
                <div className="h-5 w-5 animate-pulse rounded-[4px] bg-[var(--color-brand-panel-alt)]" />
              </td>
              <td className="px-4 py-4">
                <div className="h-5 w-36 animate-pulse rounded bg-[var(--color-brand-panel-alt)]" />
              </td>
              <td className="px-4 py-4">
                <div className="h-5 w-20 animate-pulse rounded bg-[var(--color-brand-panel-alt)]" />
              </td>
              <td className="px-4 py-4">
                <div className="h-5 w-24 animate-pulse rounded bg-[var(--color-brand-panel-alt)]" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BulkAssignModal({
  form,
  groupOptions,
  onApply,
  onChange,
  onClose,
  pending,
  selectedCount,
}: {
  form: BulkAssignFormState;
  groupOptions: GroupOption[];
  onApply: () => void;
  onChange: (next: BulkAssignFormState) => void;
  onClose: () => void;
  pending: boolean;
  selectedCount: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-overlay-strong)] p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-5 shadow-[var(--elevation-subtle)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="technical-label">BULK ASSIGN</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
              Update {selectedCount} servant{selectedCount === 1 ? "" : "s"}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Leave a field untouched if you do not want to change it for the selected rows.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pressable inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] text-[var(--text-secondary)]"
            aria-label="Close bulk assign modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-[var(--text-secondary)]">
            Gender
            <select
              value={form.gender}
              onChange={(event) => onChange({ ...form, gender: (event.target.value || "") as BulkAssignFormState["gender"] })}
              className="mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            >
              <option value="">Leave unchanged</option>
              <option value="null">Set to Not set</option>
              {SERVANT_GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-[var(--text-secondary)]">
            Group
            <select
              value={form.groupCode}
              onChange={(event) => onChange({ ...form, groupCode: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            >
              <option value="">Leave unchanged</option>
              <option value="null">Set to Not set</option>
              {groupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onApply}
            disabled={pending}
            className="pressable inline-flex items-center gap-2 rounded-lg bg-[var(--action-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
            Apply changes
          </button>
        </div>
      </div>
    </div>
  );
}

function ServantModal({
  errors,
  form,
  groupOptions,
  onChange,
  onClose,
  onSubmit,
  pending,
  servant,
}: {
  errors: ServantFormErrors;
  form: ServantFormState;
  groupOptions: GroupOption[];
  onChange: (next: ServantFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
  servant: ServantRecord | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-overlay-strong)] p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-5 shadow-[var(--elevation-subtle)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="technical-label">{servant ? "EDIT SERVANT" : "ADD SERVANT"}</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
              {servant ? form.name || "Edit servant" : "Create servant"}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Keep the profile lightweight for service assignment and filtering.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pressable inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] text-[var(--text-secondary)]"
            aria-label="Close servant modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block text-sm text-[var(--text-secondary)]">
            Name
            <input
              type="text"
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            />
            {errors.name ? <p className="mt-1 text-xs text-[var(--state-danger)]">{errors.name}</p> : null}
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-[var(--text-secondary)]">
              Gender
              <select
                value={form.gender ?? ""}
                onChange={(event) => onChange({ ...form, gender: (event.target.value || null) as NullableServantGender })}
                className="mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              >
                <option value="">Not set</option>
                {SERVANT_GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-[var(--text-secondary)]">
              Group
              <select
                value={form.groupCode ?? form.group ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  const option = groupOptions.find((item) => item.value === value);
                  onChange({
                    ...form,
                    group: option?.legacyGroup ?? null,
                    groupCode: value || null,
                  });
                }}
                className="mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              >
                <option value="">Not set</option>
                {groupOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending}
            className="pressable inline-flex items-center gap-2 rounded-lg bg-[var(--action-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {servant ? "Save changes" : "Create servant"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TeamsPageClient() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [groupFilter, setGroupFilter] = useState("");
  const [selectedServantIds, setSelectedServantIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [editingServant, setEditingServant] = useState<ServantRecord | null>(null);
  const [form, setForm] = useState<ServantFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<ServantFormErrors>({});
  const [bulkAssignForm, setBulkAssignForm] = useState<BulkAssignFormState>({ gender: "", groupCode: "" });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
    if (groupFilter) params.set("group", groupFilter);
    const value = params.toString();
    return value ? `?${value}` : "";
  }, [deferredSearch, groupFilter]);

  const servantsQuery = useQuery({
    queryKey: ["servants", queryString],
    queryFn: () => apiFetch<ServantRecord[]>(`/api/servants${queryString}`),
  });
  const servantGroupsQuery = useQuery({
    queryKey: ["settings", "servant-groups"],
    queryFn: () => apiFetch<EditableSettingsPresetRecord[]>("/api/settings/servant-groups"),
    staleTime: 30_000,
  });
  const groupOptions = useMemo(() => buildGroupOptions(servantGroupsQuery.data), [servantGroupsQuery.data]);

  const createServantMutation = useMutation({
    mutationFn: (payload: CreateServantPayload) =>
      apiFetch<ServantRecord>("/api/servants", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["servants"] });
      closeModal();
    },
  });

  const updateServantMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateServantPayload }) =>
      apiFetch<ServantRecord>(`/api/servants/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["servants"] });
      closeModal();
    },
  });

  const deleteServantMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) =>
          apiFetch<{ success: true }>(`/api/servants/${id}`, {
            method: "DELETE",
          }),
        ),
      );
    },
    onSuccess: async (_, ids) => {
      await queryClient.invalidateQueries({ queryKey: ["servants"] });
      setSelectedServantIds((current) => current.filter((id) => !ids.includes(id)));
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ ids, payload }: { ids: string[]; payload: UpdateServantPayload }) => {
      await Promise.all(
        ids.map((id) =>
          apiFetch<ServantRecord>(`/api/servants/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          }),
        ),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["servants"] });
      setBulkAssignOpen(false);
      setBulkAssignForm({ gender: "", groupCode: "" });
      setSelectedServantIds([]);
    },
  });

  function openCreateModal() {
    setEditingServant(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEditModal(servant: ServantRecord) {
    setEditingServant(servant);
    setForm({
      name: servant.name,
      gender: servant.gender,
      group: servant.group,
      groupCode: servant.groupCode,
    });
    setErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    startTransition(() => {
      setModalOpen(false);
      setEditingServant(null);
      setForm(EMPTY_FORM);
      setErrors({});
    });
  }

  function openBulkAssignModal() {
    if (selectedServantIds.length === 0) {
      return;
    }

    setBulkAssignForm({ gender: "", groupCode: "" });
    setBulkAssignOpen(true);
  }

  function closeBulkAssignModal() {
    setBulkAssignOpen(false);
    setBulkAssignForm({ gender: "", groupCode: "" });
  }

  function submitForm() {
    const nextErrors = validateServantForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = {
      name: form.name.trim(),
      gender: form.gender ?? null,
      group: form.group ?? null,
      groupCode: form.groupCode ?? form.group ?? null,
    } satisfies CreateServantPayload;

    if (editingServant) {
      updateServantMutation.mutate({ id: editingServant.id, payload });
      return;
    }

    createServantMutation.mutate(payload);
  }

  function toggleServantSelection(servantId: string) {
    setSelectedServantIds((current) =>
      current.includes(servantId) ? current.filter((id) => id !== servantId) : [...current, servantId],
    );
  }

  async function deleteSelectedServants() {
    if (selectedServantIds.length === 0) {
      return;
    }

    if (!window.confirm(`Delete ${selectedServantIds.length} servant${selectedServantIds.length === 1 ? "" : "s"}?`)) {
      return;
    }

    await deleteServantMutation.mutateAsync(selectedServantIds);
  }

  async function applyBulkAssign() {
    const payload: UpdateServantPayload = {
      ...(bulkAssignForm.gender !== "" ? { gender: bulkAssignForm.gender === "null" ? null : bulkAssignForm.gender } : {}),
      ...(bulkAssignForm.groupCode !== ""
        ? {
            group: bulkAssignForm.groupCode === "null"
              ? null
              : (groupOptions.find((option) => option.value === bulkAssignForm.groupCode)?.legacyGroup ?? null),
            groupCode: bulkAssignForm.groupCode === "null" ? null : bulkAssignForm.groupCode,
          }
        : {}),
    };

    if (Object.keys(payload).length === 0) {
      return;
    }

    await bulkAssignMutation.mutateAsync({
      ids: selectedServantIds,
      payload,
    });
  }

  const servants = servantsQuery.data ?? [];
  const pending = createServantMutation.isPending || updateServantMutation.isPending;
  const showTableSkeleton = servantsQuery.isLoading || servantsQuery.isFetching;

  return (
    <main className="min-h-full space-y-8 py-3 lg:px-2">
      <section className="space-y-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold leading-tight text-[var(--color-brand-ink)] md:text-5xl">
            Teams
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)] md:text-lg md:leading-8">
            Keep a clean roster of worship servants so service assignments can be picked fast without losing the freedom to type one-off names.
          </p>
        </div>
      </section>

      <section className="production-panel mx-auto max-w-7xl overflow-hidden">
        <div className="border-b border-[var(--color-brand-border)] px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="relative min-w-[220px] flex-1 text-sm text-[var(--color-text-secondary)]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search servant name"
                  className="block w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] py-2 pl-10 pr-3 text-[var(--color-brand-ink)]"
                />
              </label>

              <label className="min-w-[180px] max-w-[220px] flex-1 text-sm text-[var(--color-text-secondary)]">
                <select
                  value={groupFilter}
                  onChange={(event) => setGroupFilter(event.target.value)}
                  className="block w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-3 py-2 text-[var(--color-brand-ink)]"
                >
                  <option value="">All groups</option>
                  {groupOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-3 lg:justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedServantIds([]);
                  void servantsQuery.refetch();
                }}
                className="rounded-md border border-[var(--color-brand-border)] p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-panel-alt)] hover:text-[var(--color-brand-ink)]"
                aria-label="Refresh servants"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={openBulkAssignModal}
                disabled={selectedServantIds.length === 0 || bulkAssignMutation.isPending}
                className={`pressable inline-flex h-10 w-10 items-center justify-center rounded-lg border p-0 disabled:opacity-50 ${
                  selectedServantIds.length > 0
                    ? "border-[var(--color-brand-accent)] bg-[var(--color-brand-accent)] text-[var(--color-accent-ink)]"
                    : "border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] text-[var(--color-brand-ink)]"
                }`}
                aria-label="Bulk assign selected servants"
                title="Bulk assign selected servants"
              >
                {bulkAssignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => void deleteSelectedServants()}
                disabled={selectedServantIds.length === 0 || deleteServantMutation.isPending}
                className={`pressable inline-flex h-10 w-10 items-center justify-center rounded-lg border p-0 disabled:opacity-50 ${
                  selectedServantIds.length > 0
                    ? "border-[#F43F5E] bg-[#F43F5E] text-white"
                    : "border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] text-[var(--color-brand-ink)]"
                }`}
                aria-label="Delete selected servants"
                title="Delete selected servants"
              >
                {deleteServantMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                className="pressable inline-flex items-center gap-2 rounded-lg border border-[var(--color-brand-accent)] bg-[var(--color-brand-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-ink)]"
              >
                <Plus className="h-4 w-4" />
                Add Servant
              </button>
            </div>
          </div>
        </div>

        {showTableSkeleton ? (
          <TeamsTableSkeleton />
        ) : servants.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <h3 className="text-lg font-semibold text-[var(--color-brand-ink)]">No matching servants</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
              Adjust your filters or add a servant to start building the directory.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-[var(--color-brand-panel-strong)]">
                <tr className="text-left">
                  <th className="w-12 px-4 py-3" />
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Gender</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Group</th>
                </tr>
              </thead>
              <tbody>
                {servants.map((servant) => {
                  const isSelected = selectedServantIds.includes(servant.id);

                  return (
                  <tr
                    key={servant.id}
                    className={
                      isSelected
                        ? "border-t border-[var(--color-brand-border)] bg-[color:color-mix(in_srgb,var(--color-brand-accent)_12%,var(--color-brand-panel))]"
                        : "border-t border-[var(--color-brand-border)] bg-[var(--color-brand-panel)]"
                    }
                  >
                    <td className="px-4 py-4 align-top">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleServantSelection(servant.id)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Select ${servant.name}`}
                        className="h-5 w-5 appearance-none rounded-[4px] border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] align-middle shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] checked:border-[var(--color-brand-accent)] checked:bg-[var(--color-brand-accent)] checked:bg-[image:linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.02))] focus:outline-none focus:ring-2 focus:ring-[rgba(139,92,246,0.35)]"
                      />
                    </td>
                    <td
                      className="cursor-pointer px-4 py-4 text-sm font-semibold text-[var(--color-brand-ink)]"
                      onClick={() => openEditModal(servant)}
                    >
                      {servant.name}
                    </td>
                    <td
                      className="cursor-pointer px-4 py-4 text-sm text-[var(--color-text-secondary)]"
                      onClick={() => openEditModal(servant)}
                    >
                      {formatServantGenderLabel(servant.gender)}
                    </td>
                    <td
                      className="cursor-pointer px-4 py-4 text-sm text-[var(--color-text-secondary)]"
                      onClick={() => openEditModal(servant)}
                    >
                      {getGroupLabel(servant, groupOptions)}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen ? (
        <ServantModal
          errors={errors}
          form={form}
          groupOptions={groupOptions}
          onChange={setForm}
          onClose={closeModal}
          onSubmit={submitForm}
          pending={pending}
          servant={editingServant}
        />
      ) : null}

      {bulkAssignOpen ? (
        <BulkAssignModal
          form={bulkAssignForm}
          groupOptions={groupOptions}
          onApply={() => void applyBulkAssign()}
          onChange={setBulkAssignForm}
          onClose={closeBulkAssignModal}
          pending={bulkAssignMutation.isPending}
          selectedCount={selectedServantIds.length}
        />
      ) : null}
    </main>
  );
}

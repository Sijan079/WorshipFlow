"use client";

import {
  startTransition,
  type PointerEvent as ReactPointerEvent,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, Menu, Pencil, Plus, RefreshCcw, Search, Settings2, Trash2, UserRoundCheck, UsersRound, X } from "lucide-react";
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
  getServantInitials,
  SERVANT_GENDER_OPTIONS,
  SERVANT_GROUP_OPTIONS,
  type NullableServantGender,
  type ServantGender,
  type ServantGroup,
} from "@/lib/servants";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductionSelect } from "@/components/ui/production-select";

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

const SERVANT_LONG_PRESS_MS = 1_000;
const SERVANT_LONG_PRESS_MOVE_TOLERANCE = 10;

type ServantLongPressState = {
  startX: number;
  startY: number;
  timerId: number;
};

function isInteractiveRowTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button, input, a, [role='menuitem'], [data-row-interactive]"));
}

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

function TeamsListSkeleton() {
  return (
    <div aria-label="Loading team roster" className="divide-y divide-[var(--rule-default)]" role="status">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={`team-skeleton-${index}`}
          className="grid grid-cols-[24px_40px_minmax(0,1fr)_44px] items-center gap-3 px-4 py-4 lg:grid-cols-[24px_40px_minmax(0,1.3fr)_minmax(120px,.6fr)_minmax(140px,.75fr)_44px]"
        >
          <div className="h-5 w-5 animate-pulse rounded-[var(--radius-xs)] bg-[var(--surface-panel-strong)]" />
          <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--surface-panel-strong)]" />
          <div className="h-5 w-36 animate-pulse rounded bg-[var(--surface-panel-strong)]" />
          <div className="hidden h-5 w-20 animate-pulse rounded bg-[var(--surface-panel-strong)] lg:block" />
          <div className="hidden h-7 w-28 animate-pulse rounded-[var(--radius-control)] bg-[var(--surface-panel-strong)] lg:block" />
          <div className="h-10 w-10 animate-pulse rounded-md bg-[var(--surface-panel-strong)]" />
        </div>
      ))}
    </div>
  );
}

function AnimatedTrashBinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
      <g className="origin-[12px_6px] transition-transform duration-150 group-hover:-translate-y-1 group-hover:-rotate-12 motion-reduce:transform-none motion-reduce:transition-none">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
      </g>
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

function AnimatedAssignIcon() {
  return (
    <span className="inline-flex transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none">
      <UserRoundCheck className="h-5 w-5 transition-colors duration-150 group-hover:text-[var(--action-primary-bg)]" aria-hidden="true" />
    </span>
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">
              Update {selectedCount} servant{selectedCount === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[var(--text-secondary)]">
              Leave a field untouched if you do not want to change it for the selected rows.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-modal-close pressable"
            aria-label="Close bulk assign modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <ProductionSelect
            label="Gender"
            value={form.gender}
            onValueChange={(value) => onChange({ ...form, gender: value as BulkAssignFormState["gender"] })}
            triggerClassName="bg-[var(--surface-panel-strong)]"
            options={[
              { value: "", label: "Leave unchanged" },
              { value: "null", label: "Set to Not set" },
              ...SERVANT_GENDER_OPTIONS,
            ]}
          />

          <ProductionSelect
            label="Group"
            value={form.groupCode}
            onValueChange={(value) => onChange({ ...form, groupCode: value })}
            triggerClassName="bg-[var(--surface-panel-strong)]"
            options={[
              { value: "", label: "Leave unchanged" },
              { value: "null", label: "Set to Not set" },
              ...groupOptions.map((option) => ({ value: option.value, label: option.label })),
            ]}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onApply}
            disabled={pending}
            className="ui-btn-primary pressable inline-flex min-h-10 items-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
            Apply changes
          </button>
        </div>
      </DialogContent>
    </Dialog>
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">
              {servant ? "Edit Servant" : "Create Servant"}
            </DialogTitle>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-modal-close pressable"
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
              className="ui-field ui-field-inactive mt-1 w-full px-3 py-2 outline-none"
            />
            {errors.name ? <p className="mt-1 text-xs text-[var(--state-danger)]">{errors.name}</p> : null}
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <ProductionSelect
              label="Gender"
              value={form.gender ?? ""}
              onValueChange={(value) => onChange({ ...form, gender: (value || null) as NullableServantGender })}
              triggerClassName="bg-[var(--surface-panel-strong)]"
              options={[{ value: "", label: "Not set" }, ...SERVANT_GENDER_OPTIONS]}
            />

            <ProductionSelect
              label="Group"
              value={form.groupCode ?? form.group ?? ""}
              onValueChange={(value) => {
                  const option = groupOptions.find((item) => item.value === value);
                  onChange({
                    ...form,
                    group: option?.legacyGroup ?? null,
                    groupCode: value || null,
                  });
                }}
              triggerClassName="bg-[var(--surface-panel-strong)]"
              options={[
                { value: "", label: "Not set" },
                ...groupOptions.map((option) => ({ value: option.value, label: option.label })),
              ]}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending}
            className="ui-btn-primary pressable inline-flex min-h-10 items-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {servant ? "Save changes" : "Create servant"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TeamsPageClient() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [groupFilter, setGroupFilter] = useState("");
  const [selectedServantIds, setSelectedServantIds] = useState<string[]>([]);
  const [pendingDeleteServantIds, setPendingDeleteServantIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [editingServant, setEditingServant] = useState<ServantRecord | null>(null);
  const [form, setForm] = useState<ServantFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<ServantFormErrors>({});
  const [bulkAssignForm, setBulkAssignForm] = useState<BulkAssignFormState>({ gender: "", groupCode: "" });
  const servantLongPressRef = useRef<ServantLongPressState | null>(null);

  useEffect(() => () => {
    if (servantLongPressRef.current) {
      window.clearTimeout(servantLongPressRef.current.timerId);
    }
  }, []);

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
  const allServantsQuery = useQuery({
    queryKey: ["servants", "total"],
    queryFn: () => apiFetch<ServantRecord[]>("/api/servants"),
    enabled: Boolean(queryString),
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
      setPendingDeleteServantIds([]);
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

  function clearServantLongPress() {
    if (servantLongPressRef.current) {
      window.clearTimeout(servantLongPressRef.current.timerId);
      servantLongPressRef.current = null;
    }
  }

  function startServantLongPress(event: ReactPointerEvent<HTMLElement>, servantId: string) {
    if (!event.isPrimary || event.button !== 0 || isInteractiveRowTarget(event.target)) {
      return;
    }

    clearServantLongPress();
    servantLongPressRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      timerId: window.setTimeout(() => {
        servantLongPressRef.current = null;
        toggleServantSelection(servantId);
      }, SERVANT_LONG_PRESS_MS),
    };
  }

  function moveServantLongPress(event: ReactPointerEvent<HTMLElement>) {
    const press = servantLongPressRef.current;
    if (
      press
      && (Math.abs(event.clientX - press.startX) > SERVANT_LONG_PRESS_MOVE_TOLERANCE
        || Math.abs(event.clientY - press.startY) > SERVANT_LONG_PRESS_MOVE_TOLERANCE)
    ) {
      clearServantLongPress();
    }
  }

  function requestServantDelete(ids: string[]) {
    if (ids.length > 0) {
      setPendingDeleteServantIds(ids);
    }
  }

  async function confirmServantDelete() {
    if (pendingDeleteServantIds.length > 0) {
      await deleteServantMutation.mutateAsync(pendingDeleteServantIds);
    }
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
  const totalServantCount = queryString ? (allServantsQuery.data?.length ?? servants.length) : servants.length;
  const pending = createServantMutation.isPending || updateServantMutation.isPending;
  const showListSkeleton = servantsQuery.isLoading || servantsQuery.isFetching;
  const filtersActive = Boolean(search.trim() || groupFilter);

  return (
    <div className="teams-page min-h-full space-y-6 py-1 lg:px-2">
      <section className="teams-header ui-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="ui-page-title">Teams</h1>
          <p className="ui-page-description">
            Keep the servant roster ready for fast, accurate worship service assignments.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="ui-btn-primary pressable inline-flex min-h-11 items-center justify-center gap-2 self-start px-4 py-2.5 text-sm font-semibold sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add servant
        </button>
      </section>

      <section className="teams-register ui-surface-elevated ui-operational-register">
        <div className="teams-register-tools ui-register-toolbar">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <label className="min-w-[220px] flex-1 sm:max-w-[280px]">
                <span className="sr-only">Search team</span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search servant name"
                    className="ui-field block min-h-10 w-full py-2 pl-10 pr-3 text-sm"
                  />
                </span>
              </label>

              <div className="min-w-[180px] flex-1 sm:max-w-[220px]">
                <ProductionSelect
                  ariaLabel="Filter by group"
                  value={groupFilter}
                  onValueChange={setGroupFilter}
                  options={[
                    { value: "", label: "All groups" },
                    ...groupOptions.map((option) => ({ value: option.value, label: option.label })),
                  ]}
                />
              </div>

              {filtersActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setGroupFilter("");
                  }}
                  className="pressable inline-flex min-h-10 items-center justify-center gap-1.5 px-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--state-danger)]"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filters
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
              <p className="text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                {servants.length} of {totalServantCount} servants
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedServantIds([]);
                  void servantsQuery.refetch();
                }}
                className="pressable inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-accent)]"
                aria-label="Refresh servants"
              >
                <RefreshCcw className={`h-4 w-4 ${servantsQuery.isFetching ? "animate-spin" : ""}`} />
              </button>

              {selectedServantIds.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={openBulkAssignModal}
                    disabled={bulkAssignMutation.isPending}
                    className="group inline-flex h-10 w-10 items-center justify-center rounded-md bg-transparent text-[var(--text-secondary)] hover:text-[var(--action-primary-bg)] disabled:opacity-50"
                    aria-label={`Assign ${selectedServantIds.length} selected servant${selectedServantIds.length === 1 ? "" : "s"}`}
                    title={`Assign ${selectedServantIds.length} selected servant${selectedServantIds.length === 1 ? "" : "s"}`}
                  >
                    {bulkAssignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AnimatedAssignIcon />}
                  </button>
                  <button
                    type="button"
                    onClick={() => requestServantDelete(selectedServantIds)}
                    disabled={deleteServantMutation.isPending}
                    className="group inline-flex h-10 w-10 items-center justify-center rounded-md bg-transparent text-[var(--text-danger)] disabled:opacity-50"
                    aria-label={`Delete ${selectedServantIds.length} selected servant${selectedServantIds.length === 1 ? "" : "s"}`}
                    title={`Delete ${selectedServantIds.length} selected servant${selectedServantIds.length === 1 ? "" : "s"}`}
                  >
                    {deleteServantMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AnimatedTrashBinIcon />}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {showListSkeleton ? (
          <TeamsListSkeleton />
        ) : servants.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <UsersRound className="h-8 w-8 text-[var(--text-muted)]" />
            <h3 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">No matching servants</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
              Adjust your filters or add a servant to start building the directory.
            </p>
          </div>
        ) : (
          <div>
            <div
              aria-hidden="true"
              className="ui-ledger-header hidden grid-cols-[24px_40px_minmax(0,1.3fr)_minmax(120px,.6fr)_minmax(140px,.75fr)_44px] items-center gap-3 px-4 py-2.5 lg:grid"
            >
              <span />
              <span />
              <span>Servant</span>
              <span>Gender</span>
              <span>Group</span>
              <span />
            </div>
            <ul>
              {servants.map((servant) => {
                const isSelected = selectedServantIds.includes(servant.id);
                const groupLabel = getGroupLabel(servant, groupOptions);

                return (
                  <li
                    key={servant.id}
                    className="group ui-ledger-row ui-ledger-row-holdable select-none"
                    data-selected={isSelected}
                    onPointerDown={(event) => startServantLongPress(event, servant.id)}
                    onPointerMove={moveServantLongPress}
                    onPointerUp={clearServantLongPress}
                    onPointerCancel={clearServantLongPress}
                    onPointerLeave={clearServantLongPress}
                    onContextMenu={(event) => {
                      if (!isInteractiveRowTarget(event.target)) event.preventDefault();
                    }}
                    title="Press and hold for one second to select"
                  >
                    <div className="grid grid-cols-[24px_40px_minmax(0,1fr)_44px] items-center gap-3 px-4 py-4 lg:grid-cols-[24px_40px_minmax(0,1.3fr)_minmax(120px,.6fr)_minmax(140px,.75fr)_44px]">
                      <label
                        data-row-interactive="true"
                        className="flex h-10 w-10 items-center justify-center justify-self-center"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleServantSelection(servant.id)}
                          aria-label={`Select ${servant.name}`}
                          className="ui-checkbox h-5 w-5"
                        />
                      </label>
                      <span
                        aria-hidden="true"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-panel-strong)] text-sm font-semibold text-[var(--text-accent)]"
                      >
                        {getServantInitials(servant.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{servant.name}</p>
                        <p className="mt-1 truncate text-xs text-[var(--text-muted)] lg:hidden">
                          {formatServantGenderLabel(servant.gender)} · {groupLabel}
                        </p>
                      </div>
                      <p className="hidden truncate text-sm text-[var(--text-secondary)] lg:block">
                        {formatServantGenderLabel(servant.gender)}
                      </p>
                      <span className="hidden w-fit max-w-full truncate rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] lg:block">
                        {groupLabel}
                      </span>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="ui-row-menu-trigger ui-row-menu-trigger-edge"
                            aria-label={`Actions for ${servant.name}`}
                            title={`Actions for ${servant.name}`}
                          >
                            <Menu className="h-5 w-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          side="left"
                          sideOffset={8}
                          className="workspace-content-light ui-action-menu-content w-40"
                        >
                          <DropdownMenuItem
                            onSelect={() => openEditModal(servant)}
                            className="ui-action-menu-item gap-2 px-2"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => requestServantDelete([servant.id])}
                            className="ui-action-menu-item ui-action-menu-item-danger gap-2 px-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                );
              })}
            </ul>
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

      <Dialog
        open={pendingDeleteServantIds.length > 0}
        onOpenChange={(open) => {
          if (!open && !deleteServantMutation.isPending) {
            setPendingDeleteServantIds([]);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <button
            type="button"
            onClick={() => setPendingDeleteServantIds([])}
            disabled={deleteServantMutation.isPending}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label="Close delete confirmation"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <DialogTitle className="pr-12 text-xl font-semibold text-[var(--text-primary)]">
            Delete {pendingDeleteServantIds.length} servant{pendingDeleteServantIds.length === 1 ? "" : "s"}?
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            This will permanently remove the selected servant records from the team roster.
          </DialogDescription>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => void confirmServantDelete()}
              disabled={deleteServantMutation.isPending}
              className="pressable inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:border-transparent hover:bg-[var(--state-danger)] hover:text-[var(--action-primary-ink)] active:border-transparent active:bg-[var(--state-danger)] active:text-[var(--action-primary-ink)] disabled:opacity-60"
            >
              {deleteServantMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {pendingDeleteServantIds.length === 1 ? "Delete servant" : "Delete Selected"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

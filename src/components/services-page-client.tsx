"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Edit3, Loader2, Menu, Plus, RefreshCw, Save, Search, Trash2, WandSparkles, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  apiFetch,
  type CreateServicePayload,
  type ServiceRecord,
  type ServiceTemplatePresetRecord,
  type SongRecord,
} from "@/lib/api-client";
import { parseTemplateServiceText } from "@/lib/template-service-text-parser";
import {
  ASSIGNED_MINISTRY_OPTIONS,
  getDefaultNextServiceSunday,
  inferAssignedMinistryFromName,
  mapAssignedMinistryToLegacyMinistryName,
  type AssignedMinistry,
  type PledgeType,
  type ServiceHymnalRole,
  type ServiceServantRole,
  type ServiceTemplateType,
} from "@/lib/service-records";
import { ServiceStatus } from "@/lib/service-constants";
import { fetchMinistryOptions, fetchPeopleNames, type MinistryOptionRecord, type PersonNameRecord } from "@/features/people/people-api";
import { ministryCodeFromLegacy } from "@/lib/ministries";
import { PAPToastViewport, usePAPToasts } from "@/features/pap/components/pap-toasts";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProductionDatePicker } from "@/components/ui/production-date-picker";
import { ProductionSelect } from "@/components/ui/production-select";
import { addTeamMember, filterTeamMembers, removeTeamMember } from "@/lib/team-member-picker";

type ServiceFormState = {
  assignedMinistry: string;
  serviceDate: string;
  sermonVerse: string;
  templateType: string;
  pledgeType: PledgeType | "";
  bibleVerses: string[];
  servantAssignments: Record<ServiceServantRole, string>;
  offeringPeople: [string, string];
  hymnals: Record<ServiceHymnalRole, string>;
  templateBlockValues: Record<string, Record<string, unknown>>;
};

type ServiceFormErrors = Partial<
  Record<
    | "assignedMinistry"
    | "serviceDate"
    | "sermonVerse"
    | "pledgeType"
    | "bibleVerses"
    | ServiceServantRole
    | ServiceHymnalRole,
    string
  >
>;

type ServiceBlockValues = Record<string, Record<string, unknown>>;

type MinistryOption = {
  value: string;
  label: string;
  assignedMinistry: AssignedMinistry;
};

type TemplateOption = {
  value: string;
  label: string;
  templateType: ServiceTemplateType;
};

const SERVICE_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatServiceDate(dateString: string) {
  return SERVICE_DATE_FORMATTER.format(new Date(dateString));
}

function formatServiceStatus(status: string) {
  return status.toLowerCase().replaceAll("_", " ").replace(/^\w/, (character) => character.toUpperCase());
}

function getServiceStatusColor(status: string) {
  if (status === ServiceStatus.READY) return "var(--state-success)";
  if (status === ServiceStatus.DRAFT) return "var(--state-danger)";
  if (status === ServiceStatus.ARCHIVED) return "var(--state-idle)";
  return "var(--state-warning)";
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

function ServicesListSkeleton() {
  return (
    <div aria-label="Loading worship services" className="divide-y divide-[var(--rule-default)]" role="status">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={`service-skeleton-${index}`}
          className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-3 px-4 py-4 min-[600px]:grid-cols-[36px_minmax(0,1fr)_44px] min-[1200px]:grid-cols-[56px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(100px,.65fr)_44px]"
        >
          <div className="h-5 w-5 animate-pulse rounded-[4px] bg-[var(--surface-panel-strong)]" />
          <div className="space-y-2">
            <div className="h-5 w-36 animate-pulse rounded bg-[var(--surface-panel-strong)]" />
            <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-panel-strong)] min-[1200px]:hidden" />
          </div>
          <div className="hidden h-5 w-28 animate-pulse rounded bg-[var(--surface-panel-strong)] min-[1200px]:block" />
          <div className="hidden h-5 w-16 animate-pulse rounded bg-[var(--surface-panel-strong)] min-[1200px]:block" />
          <div className="col-start-2 h-10 w-20 animate-pulse rounded-md bg-[var(--surface-panel-strong)] min-[600px]:col-auto min-[600px]:w-10" />
        </div>
      ))}
    </div>
  );
}

function createBlankServiceForm(): ServiceFormState {
  return {
    assignedMinistry: "LADIES",
    serviceDate: getDefaultNextServiceSunday().toISOString().slice(0, 10),
    sermonVerse: "",
    templateType: "REGULAR",
    pledgeType: "",
    bibleVerses: [""],
    servantAssignments: {
      CALL_TO_WORSHIP: "",
      EMCEE: "",
      SCRIPTURE_READER: "",
      SERMON_SPEAKER: "",
      OFFERING: "",
      PLEDGE_READER: "",
    },
    offeringPeople: ["", ""],
    hymnals: {
      HYMN_OF_PREPARATION: "",
      HYMN_OF_RESPONSE: "",
      SONG_OF_HYMNS: "",
    },
    templateBlockValues: {},
  };
}

function normalizeServiceForm(form: ServiceFormState): ServiceFormState {
  return {
    ...form,
    offeringPeople: Array.isArray(form.offeringPeople)
      ? [form.offeringPeople[0] ?? "", form.offeringPeople[1] ?? ""]
      : ["", ""],
  };
}

function formatAssignedMinistry(assignedMinistry?: string | null, ministryName?: string | null) {
  return assignedMinistry
    ? mapAssignedMinistryToLegacyMinistryName(assignedMinistry as AssignedMinistry)
    : (ministryName || "Mixed");
}

function formatTemplateLabel(templateType?: string | null) {
  return templateType === "FIRST_SUNDAY" ? "1st Sunday" : "Regular";
}

function buildMinistryOptions(records: MinistryOptionRecord[] = []): MinistryOption[] {
  if (records.length > 0) {
    return records.map((record) => ({
      value: record.code,
      label: record.label,
      // Services still record the older ministry enum; Church Leaders was called Leaders there.
      assignedMinistry: record.code === "CHURCH_LEADERS"
        ? "LEADERS"
        : ASSIGNED_MINISTRY_OPTIONS.some((item) => item.value === record.code)
          ? (record.code as AssignedMinistry)
          : inferAssignedMinistryFromName(record.label),
    }));
  }

  return ASSIGNED_MINISTRY_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    assignedMinistry: option.value,
  }));
}

function buildTemplateOptions(records: ServiceTemplatePresetRecord[] = []): TemplateOption[] {
  return records.map((record) => ({
    value: record.code,
    label: record.label,
    templateType: record.templateType,
  }));
}

function getSelectedTemplateType(templateCode: string, templateOptions: TemplateOption[]) {
  return templateOptions.find((option) => option.value === templateCode)?.templateType
    ?? (templateCode === "FIRST_SUNDAY" ? "FIRST_SUNDAY" : "REGULAR");
}

function validateServiceForm(form: ServiceFormState): ServiceFormErrors {
  const errors: ServiceFormErrors = {};

  if (!form.serviceDate) {
    errors.serviceDate = "Service date is required.";
  }

  return errors;
}

function getServiceBlockValues(blocks: ServiceRecord["blocks"]): ServiceBlockValues {
  return Object.fromEntries(blocks.map((block) => {
    const fieldValues = block.fieldValues;
    const values = fieldValues && typeof fieldValues === "object" && !Array.isArray(fieldValues)
      ? fieldValues as Record<string, unknown>
      : block.kind === "PERSON" ? { personIds: [] } : { text: "" };
    return [block.id, values];
  }));
}

function buildServicePayload(
  form: ServiceFormState,
  ministryOptions: MinistryOption[],
  templateOptions: TemplateOption[],
): CreateServicePayload {
  const normalizedForm = normalizeServiceForm(form);
  const ministryOption = ministryOptions.find((option) => option.value === normalizedForm.assignedMinistry);
  const templateOption = templateOptions.find((option) => option.value === normalizedForm.templateType);
  const templateType = templateOption?.templateType ?? getSelectedTemplateType(normalizedForm.templateType, templateOptions);
  return {
    serviceDate: new Date(normalizedForm.serviceDate).toISOString(),
    assignedMinistry: ministryOption?.assignedMinistry ?? inferAssignedMinistryFromName(ministryOption?.label),
    ministryPresetCode: ministryOption?.value ?? normalizedForm.assignedMinistry,
    status: ServiceStatus.DRAFT,
    templateType,
    templatePresetCode: templateOption?.value ?? normalizedForm.templateType,
    templateBlockValues: Object.entries(normalizedForm.templateBlockValues).map(([templateBlockId, values]) => ({ templateBlockId, values })),
  };
}

function TeamMemberPicker({
  members,
  personIds,
  onChange,
  disabled = false,
}: {
  members: PersonNameRecord[];
  personIds: string[];
  onChange: (personIds: string[]) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const availableMembers = filterTeamMembers(members, search, personIds);

  // Close the list when the pointer goes down anywhere outside this field.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [isOpen]);

  const selectMember = (personId: string) => {
    onChange(addTeamMember(personIds, personId));
    setSearch("");
    setIsOpen(true);
  };

  return (
    <div ref={rootRef} className="mt-3">
      {personIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {personIds.map((personId) => {
            const member = members.find((candidate) => candidate.id === personId);
            return (
              <button
                key={personId}
                type="button"
                onClick={() => onChange(removeTeamMember(personIds, personId))}
                disabled={disabled}
                className="pressable inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-60"
                aria-label={`Remove ${member ? member.name : "Team member"}`}
              >
                {member ? member.name : "Unavailable member"} <span aria-hidden="true">×</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className={`relative ${personIds.length > 0 ? "mt-2" : ""}`}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Name"
          disabled={disabled}
          aria-label="Search people by name"
          className="ui-raised-field h-11 w-full pl-10 pr-11 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          disabled={disabled}
          className="absolute right-1 top-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-panel-alt)] disabled:opacity-60"
          aria-label={isOpen ? "Hide people" : "Show people"}
          aria-expanded={isOpen}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {isOpen ? (
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-[var(--border-strong)] bg-[var(--surface-panel-elevated)] py-1 shadow-[var(--elevation-modal)]">
            {availableMembers.length ? availableMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => selectMember(member.id)}
                className="flex min-h-10 w-full items-center px-3 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-panel-alt)]"
              >
                {member.name}
              </button>
            )) : <p className="px-3 py-2 text-sm text-[var(--text-muted)]">No matching people.</p>}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TemplateDefinedServiceFields({
  form,
  errors,
  ministryOptions,
  templateOptions,
  templates,
  servants,
  songs,
  onChange,
}: {
  form: ServiceFormState;
  errors: ServiceFormErrors;
  ministryOptions: MinistryOption[];
  templateOptions: TemplateOption[];
  templates: ServiceTemplatePresetRecord[];
  servants: PersonNameRecord[];
  songs: SongRecord[];
  onChange: (form: ServiceFormState) => void;
}) {
  const template = templates.find((candidate) => candidate.code === form.templateType);
  const updateTemplate = (templateCode: string) => {
    const selected = templates.find((candidate) => candidate.code === templateCode);
    onChange({
      ...form,
      templateType: templateCode,
      templateBlockValues: Object.fromEntries((selected?.blocks ?? []).map((block) => [block.id, block.kind === "PERSON" ? { personIds: [] } : { text: "" }])),
    });
  };
  const updateValue = (blockId: string, key: string, value: unknown) => onChange({
    ...form,
    templateBlockValues: {
      ...form.templateBlockValues,
      [blockId]: { ...(form.templateBlockValues[blockId] ?? {}), [key]: value },
    },
  });
  const autoSizeTextarea = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 border-b border-[var(--rule-default)] pb-5 md:grid-cols-3">
        <ProductionSelect label="Assigned Ministry" value={form.assignedMinistry} onValueChange={(assignedMinistry) => onChange({ ...form, assignedMinistry })} options={ministryOptions} />
        <div>
          <ProductionDatePicker label="Date" value={form.serviceDate} onValueChange={(serviceDate) => onChange({ ...form, serviceDate })} />
          {errors.serviceDate ? <p className="mt-1 text-xs text-[var(--state-danger)]">{errors.serviceDate}</p> : null}
        </div>
        <ProductionSelect label="Template" value={form.templateType} onValueChange={updateTemplate} options={templateOptions.map((option) => ({ value: option.value, label: option.label }))} disabled={templateOptions.length === 0} />
      </div>
      {!template ? <p className="text-sm text-[var(--state-warning)]">Select a saved template to load its service fields.</p> : null}
      {template?.blocks.length ? <div className="grid gap-3 md:grid-cols-2">
        {template.blocks.map((block) => (
          <section key={block.id} className="min-w-0 space-y-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{block.label}</h3>
            {block.kind === "TEXT" ? (
              <textarea
                ref={autoSizeTextarea}
                aria-label={block.label ?? undefined}
                value={String(form.templateBlockValues[block.id]?.text ?? "")}
                onChange={(event) => updateValue(block.id, "text", event.target.value)}
                onInput={(event) => autoSizeTextarea(event.currentTarget)}
                rows={2}
                className="service-block-textarea min-h-14 w-full resize-none overflow-hidden rounded-md border border-[var(--border-default)] bg-transparent px-3 py-2 text-[var(--text-primary)] shadow-none"
                style={{ backgroundColor: "transparent", boxShadow: "none" }}
              />
            ) : (
              <TeamMemberPicker members={servants} personIds={Array.isArray(form.templateBlockValues[block.id]?.personIds) ? form.templateBlockValues[block.id]?.personIds as string[] : []} onChange={(personIds) => updateValue(block.id, "personIds", personIds)} />
            )}
            {block.fieldDefinition.fields.length ? <div className="grid gap-3 pt-1 md:grid-cols-2">
            {block.fieldDefinition.fields.map((field) => {
              const value = form.templateBlockValues[block.id]?.[field.key] ?? block.fieldDefaults?.[field.key] ?? (field.type === "checkbox" ? false : "");
              const label = <span>{field.label}{field.required ? <span className="text-[var(--state-danger)]"> *</span> : null}</span>;
              if (field.type === "checkbox") return <label key={field.key} className="flex min-h-11 items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={Boolean(value)} onChange={(event) => updateValue(block.id, field.key, event.target.checked)} />{label}</label>;
              if (field.type === "long_text") return <label key={field.key} className="block text-sm text-[var(--text-secondary)] md:col-span-2">{label}<textarea value={String(value)} onChange={(event) => updateValue(block.id, field.key, event.target.value)} placeholder={field.helpText} rows={3} className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-[var(--text-primary)]" /></label>;
              if (field.type === "single_select") return <div key={field.key} className="text-sm text-[var(--text-secondary)]"><span>{label}</span><ProductionSelect className="mt-1" ariaLabel={field.label} value={String(value)} onValueChange={(nextValue) => updateValue(block.id, field.key, nextValue)} options={[{ value: "", label: "Select…" }, ...(field.options ?? []).map((option) => ({ value: option, label: option }))]} /></div>;
              if (field.type === "person") return <div key={field.key} className="text-sm text-[var(--text-secondary)]"><span>{label}</span><ProductionSelect className="mt-1" ariaLabel={field.label} value={String(value)} onValueChange={(nextValue) => updateValue(block.id, field.key, nextValue)} options={[{ value: "", label: "Select person…" }, ...servants.map((servant) => ({ value: servant.id, label: servant.name }))]} /></div>;
              if (field.type === "song") return <div key={field.key} className="text-sm text-[var(--text-secondary)]"><span>{label}</span><ProductionSelect className="mt-1" ariaLabel={field.label} value={String(value)} onValueChange={(nextValue) => updateValue(block.id, field.key, nextValue)} options={[{ value: "", label: "Select song…" }, ...songs.map((song) => ({ value: song.id, label: song.title }))]} /></div>;
              return <label key={field.key} className="block text-sm text-[var(--text-secondary)]">{label}<input type={field.type === "duration" ? "number" : "text"} value={String(value)} onChange={(event) => updateValue(block.id, field.key, field.type === "duration" && event.target.value ? Number(event.target.value) : event.target.value)} placeholder={field.helpText} className="mt-1 h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 text-[var(--text-primary)]" /></label>;
            })}
            </div> : null}
          </section>
        ))}
      </div> : null}
    </div>
  );
}

function ServiceBlockEditor({
  blocks,
  values,
  servants,
  onChange,
}: {
  blocks: ServiceRecord["blocks"];
  values: ServiceBlockValues;
  servants: PersonNameRecord[];
  onChange: (values: ServiceBlockValues) => void;
}) {
  const updateValue = (blockId: string, nextValues: Record<string, unknown>) => {
    onChange({ ...values, [blockId]: nextValues });
  };
  const autoSizeTextarea = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {blocks.map((block) => {
        const blockValues = values[block.id] ?? (block.kind === "PERSON" ? { personIds: [] } : { text: "" });
        const personIds = Array.isArray(blockValues.personIds)
          ? blockValues.personIds.filter((id): id is string => typeof id === "string")
          : [];
        const textValue = typeof blockValues.text === "string" ? blockValues.text : "";

        return (
          <section key={block.id} className="min-w-0 space-y-2">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">{block.label}</h4>
            <div>
              {block.kind === "PERSON" ? (
                <TeamMemberPicker
                  members={servants}
                  personIds={personIds}
                  onChange={(nextPersonIds) => updateValue(block.id, { personIds: nextPersonIds })}
                />
              ) : (
                <textarea
                  ref={autoSizeTextarea}
                  aria-label={block.label ?? undefined}
                  value={textValue}
                  onChange={(event) => updateValue(block.id, { text: event.target.value })}
                  onInput={(event) => autoSizeTextarea(event.currentTarget)}
                  rows={2}
                  className="service-block-textarea min-h-14 w-full resize-none overflow-hidden rounded-md border border-[var(--border-default)] bg-transparent px-3 py-2 text-[var(--text-primary)] shadow-none"
                  style={{ backgroundColor: "transparent", boxShadow: "none" }}
                />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ReadOnlyServiceDetails({ service, servants }: { service: ServiceListItem; servants: PersonNameRecord[] }) {
  const servantNameById = new Map(servants.map((servant) => [servant.id, servant.name]));

  return (
    <div className="space-y-1">
      {service.blocks.length ? (
        service.blocks.map((block, index) => {
          const values = block.fieldValues as { text?: unknown; personIds?: unknown };
          const personIds = Array.isArray(values.personIds) ? values.personIds.filter((id): id is string => typeof id === "string") : [];
          const assignedNames = personIds.map((id) => servantNameById.get(id)).filter((name): name is string => Boolean(name));
          const value = block.kind === "PERSON"
            ? assignedNames.length ? assignedNames.join(", ") : personIds.length ? `${personIds.length} ${personIds.length === 1 ? "person" : "people"} assigned` : "Not set"
            : typeof values.text === "string" && values.text.trim() ? values.text : "Not set";

          return (
            <div
              key={block.id}
              className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-md px-2 py-3 text-sm min-[600px]:grid-cols-[2rem_minmax(0,0.8fr)_minmax(0,1.2fr)] min-[600px]:px-4"
            >
              <span className="font-mono text-xs font-medium text-[var(--text-muted)]">{String(index + 1).padStart(2, "0")}</span>
              <span className="font-medium text-[var(--text-primary)]">{block.label}</span>
              <span className={`col-start-2 min-w-0 whitespace-pre-wrap break-words text-left min-[600px]:col-auto min-[600px]:text-right ${value === "Not set" ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]"}`}>{value}</span>
            </div>
          );
        })
      ) : (
        <p className="rounded-md bg-[var(--surface-panel-alt)] px-4 py-5 text-sm text-[var(--text-muted)]">No blocks were copied from this service template.</p>
      )}
    </div>
  );
}

type ServiceListItem = ServiceRecord & {
  dateKey: string;
  dateLabel: string;
  ministryLabel: string;
  templateLabel: string;
};

export default function ServicesPageClient({ initialServices }: { initialServices?: ServiceRecord[] }) {
  const queryClient = useQueryClient();
  const { dismissToast, showToast, toasts } = usePAPToasts();
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editBlockValues, setEditBlockValues] = useState<ServiceBlockValues>({});
  const [editServiceDate, setEditServiceDate] = useState("");
  const [editMinistryPresetCode, setEditMinistryPresetCode] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createParserOpen, setCreateParserOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteServiceIds, setPendingDeleteServiceIds] = useState<string[] | null>(null);
  const [createForm, setCreateForm] = useState<ServiceFormState>(() => createBlankServiceForm());
  const [createParserText, setCreateParserText] = useState("");
  const [createErrors, setCreateErrors] = useState<ServiceFormErrors>({});
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("");
  const selectionCheckboxRef = useRef<HTMLInputElement>(null);
  const compactSelectionCheckboxRef = useRef<HTMLInputElement>(null);

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: () => apiFetch<ServiceRecord[]>("/api/services"),
    ...(initialServices ? { initialData: initialServices } : {}),
    staleTime: 30_000,
  });
  const servantsQuery = useQuery({
    queryKey: ["people", "names"],
    queryFn: fetchPeopleNames,
    staleTime: 30_000,
  });
  const ministriesQuery = useQuery({
    queryKey: ["ministries", "options"],
    queryFn: fetchMinistryOptions,
    staleTime: 30_000,
  });
  const serviceTemplatesQuery = useQuery({
    queryKey: ["settings", "service-templates"],
    queryFn: () => apiFetch<ServiceTemplatePresetRecord[]>("/api/settings/service-templates"),
    staleTime: 30_000,
  });

  const ministryOptions = useMemo(() => buildMinistryOptions(ministriesQuery.data), [ministriesQuery.data]);
  const templateOptions = useMemo(() => buildTemplateOptions(serviceTemplatesQuery.data), [serviceTemplatesQuery.data]);
  const ministryLabelByCode = useMemo(
    () => new Map(ministryOptions.map((option) => [option.value, option.label])),
    [ministryOptions],
  );
  const templateLabelByCode = useMemo(
    () => new Map(templateOptions.map((option) => [option.value, option.label])),
    [templateOptions],
  );

  const services = useMemo<ServiceListItem[]>(
    () =>
      (servicesQuery.data ?? []).map((service) => ({
        ...service,
        dateKey: new Date(service.serviceDate).toISOString().slice(0, 10),
        dateLabel: formatServiceDate(service.serviceDate),
        ministryLabel: ministryLabelByCode.get(ministryCodeFromLegacy(service.ministryPresetCode ?? ""))
          ?? formatAssignedMinistry(service.assignedMinistry, service.ministryName),
        templateLabel: templateLabelByCode.get(service.templatePresetCode ?? "")
          ?? formatTemplateLabel(service.templateType),
      })),
    [ministryLabelByCode, servicesQuery.data, templateLabelByCode]
  );
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesDate = !dateFilter || service.dateKey === dateFilter;
      const serviceMinistry = ministryCodeFromLegacy(service.ministryPresetCode ?? service.assignedMinistry ?? "MIXED");
      const matchesMinistry = !ministryFilter || ministryFilter === serviceMinistry;
      return matchesDate && matchesMinistry;
    });
  }, [dateFilter, ministryFilter, services]);
  const selectedFilteredServiceCount = filteredServices.filter((service) => selectedServiceIds.includes(service.id)).length;
  const allFilteredServicesSelected = filteredServices.length > 0 && selectedFilteredServiceCount === filteredServices.length;
  const selectionStateLabel = allFilteredServicesSelected ? "All" : selectedFilteredServiceCount > 0 ? "Partial" : "None";
  const expandedService = filteredServices.find((service) => service.id === expandedServiceId)
    ?? services.find((service) => service.id === expandedServiceId)
    ?? null;
  const showTableSkeleton = servicesQuery.isLoading || servicesQuery.isFetching || !servicesQuery.data;
  const isRefreshingServices = servicesQuery.isFetching;
  const deleteServiceIds = pendingDeleteServiceIds ?? selectedServiceIds;

  useEffect(() => {
    if (selectionCheckboxRef.current) {
      selectionCheckboxRef.current.indeterminate = selectedFilteredServiceCount > 0 && !allFilteredServicesSelected;
    }
    if (compactSelectionCheckboxRef.current) {
      compactSelectionCheckboxRef.current.indeterminate = selectedFilteredServiceCount > 0 && !allFilteredServicesSelected;
    }
  }, [allFilteredServicesSelected, selectedFilteredServiceCount]);

  const createServiceMutation = useMutation({
    mutationFn: (payload: CreateServicePayload) =>
      apiFetch<ServiceRecord>("/api/services", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (service) => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
      setExpandedServiceId(service.id);
      setEditingServiceId(null);
      setCreateModalOpen(false);
      setCreateForm(createBlankServiceForm());
      setCreateErrors({});
    },
    onError: () => {
      showToast("Service could not be created. Review the form and try again.", "error");
    },
  });
  const songsQuery = useQuery({
    queryKey: ["songs"],
    queryFn: () => apiFetch<SongRecord[]>("/api/songs"),
    staleTime: 30_000,
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, blockValues, serviceDate, assignedMinistry, ministryPresetCode }: { id: string; blockValues: ServiceBlockValues; serviceDate: string; assignedMinistry: AssignedMinistry; ministryPresetCode: string }) => {
      const service = await apiFetch<ServiceRecord>(`/api/services/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          serviceDate: new Date(serviceDate).toISOString(),
          assignedMinistry,
          ministryPresetCode,
        }),
      });
      await Promise.all(
        Object.entries(blockValues).map(([blockId, values]) =>
          apiFetch(`/api/services/${id}/blocks/${blockId}/values`, {
            method: "PUT",
            body: JSON.stringify({ values }),
          })
        )
      );
      return service;
    },
    onSuccess: () => {
      setEditingServiceId(null);
    },
    onError: (error: Error) => showToast(error.message || "Service could not be updated.", "error"),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });

  const markReadyMutation = useMutation({
    mutationFn: (id: string) => apiFetch<ServiceRecord>(`/api/services/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status: ServiceStatus.READY }),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (error: Error) => showToast(error.message || "Service could not be marked ready.", "error"),
  });

  const deleteServicesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) =>
          apiFetch<{ message: string }>(`/api/services/${id}`, {
            method: "DELETE",
          })
        )
      );
    },
    onSuccess: async (_, ids) => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
      setSelectedServiceIds((current) => current.filter((id) => !ids.includes(id)));
      if (expandedServiceId && ids.includes(expandedServiceId)) {
        setExpandedServiceId(null);
        setEditingServiceId(null);
      }
      setPendingDeleteServiceIds(null);
      setDeleteConfirmOpen(false);
    },
  });

  function prepareServiceSave(action: "create" | "update", form: ServiceFormState, serviceId?: string) {
    if (action === "create" && !templateOptions.some((option) => option.value === form.templateType)) {
      showToast("Add and select a saved template under Settings → Templates before creating a service.");
      return;
    }

    const errors = validateServiceForm(form);
    if (action === "create") {
      setCreateErrors(errors);
    }

    if (Object.keys(errors).length > 0) {
      if (errors.OFFERING) {
        showToast(errors.OFFERING);
      }
      return;
    }

    const payload = buildServicePayload(form, ministryOptions, templateOptions);
    if (action === "create") {
      createServiceMutation.mutate(payload);
      return;
    }

    if (!serviceId) {
      return;
    }

    updateServiceMutation.mutate(buildEditServiceMutationInput(serviceId));
  }

  function submitCreateForm() {
    prepareServiceSave("create", createForm);
  }

  function applyCreateParser() {
    const input = createParserText.trim();
    if (!input) return;

    const template = (serviceTemplatesQuery.data ?? []).find((candidate) => candidate.code === createForm.templateType);
    if (!template) {
      showToast("Select a service template before parsing text.");
      return;
    }
    const parsed = parseTemplateServiceText(input, {
      blocks: template.blocks,
      servants: servantsQuery.data ?? [],
      songs: songsQuery.data ?? [],
    });
    if (parsed.matches.length === 0) {
      showToast("No template fields matched. Update the text and try again.", "error");
      return;
    }

    setCreateForm((current) => ({
      ...current,
      templateBlockValues: Object.fromEntries(Object.entries(current.templateBlockValues).map(([blockId, values]) => [blockId, { ...values, ...(parsed.values[blockId] ?? {}) }])),
    }));
    setCreateErrors({});
    setCreateParserOpen(false);
    setCreateParserText("");
    if (parsed.warnings.length > 0) {
      showToast(`${parsed.matches.length} field${parsed.matches.length === 1 ? "" : "s"} applied. ${parsed.warnings.length} line${parsed.warnings.length === 1 ? "" : "s"} need review.`);
    }
  }

  function closeDeleteConfirm() {
    setPendingDeleteServiceIds(null);
    setDeleteConfirmOpen(false);
  }

  function submitEditForm() {
    if (!expandedService) {
      return;
    }

    if (!editServiceDate) {
      showToast("Service date is required.");
      return;
    }

    if (!ministryOptions.some((option) => option.value === editMinistryPresetCode)) {
      showToast("Select a ministry.");
      return;
    }

    updateServiceMutation.mutate(buildEditServiceMutationInput(expandedService.id));
  }

  function buildEditServiceMutationInput(id: string) {
    const ministryOption = ministryOptions.find((option) => option.value === editMinistryPresetCode);
    return {
      id,
      blockValues: editBlockValues,
      serviceDate: editServiceDate,
      assignedMinistry: ministryOption?.assignedMinistry ?? "MIXED",
      ministryPresetCode: editMinistryPresetCode,
    };
  }

  function toggleServiceSelection(serviceId: string) {
    setSelectedServiceIds((current) =>
      current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId]
    );
  }

  function toggleFilteredServiceSelection() {
    const filteredServiceIds = new Set(filteredServices.map((service) => service.id));

    setSelectedServiceIds((current) => {
      const allSelected = filteredServices.length > 0 && filteredServices.every((service) => current.includes(service.id));
      return allSelected
        ? current.filter((serviceId) => !filteredServiceIds.has(serviceId))
        : [...new Set([...current, ...filteredServiceIds])];
    });
  }

  function toggleExpandedService(service: ServiceRecord) {
    if (expandedServiceId === service.id) {
      setExpandedServiceId(null);
      setEditingServiceId(null);
      return;
    }

    setExpandedServiceId(service.id);
    setEditingServiceId(null);
    setEditBlockValues(getServiceBlockValues(service.blocks));
  }

  function startEditingService(service: ServiceRecord) {
    setExpandedServiceId(service.id);
    setEditingServiceId(service.id);
    setEditBlockValues(getServiceBlockValues(service.blocks));
    setEditServiceDate(new Date(service.serviceDate).toISOString().slice(0, 10));
    setEditMinistryPresetCode(ministryCodeFromLegacy(service.ministryPresetCode ?? service.assignedMinistry ?? ministryOptions[0]?.value ?? ""));
  }

  return (
    <div className="services-page min-h-full space-y-6 py-1 lg:px-2">
      <section className="services-header ui-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="ui-page-title text-3xl font-semibold leading-10 text-[var(--text-primary)]">
            Worship Services
          </h1>
          <p className="ui-page-description mt-2 text-sm leading-6 text-[var(--text-secondary)] md:text-base">
            Prepare each service record, its people, and its source material before building the service order.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="ui-btn-primary pressable inline-flex min-h-11 items-center justify-center gap-2 self-start px-4 py-2.5 text-sm font-semibold sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add service
        </button>
      </section>

      <section className="services-register ui-surface-elevated ui-operational-register">
        <div className="services-register-tools ui-register-toolbar">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <ProductionDatePicker
                ariaLabel="Filter by service date"
                value={dateFilter}
                onValueChange={setDateFilter}
                allowClear
                className="min-w-[180px] flex-1 sm:max-w-[220px]"
                triggerClassName="bg-[var(--surface-panel-alt)]"
              />

              <div className="min-w-[180px] flex-1 sm:max-w-[220px]">
                <ProductionSelect
                  ariaLabel="Filter by ministry"
                  value={ministryFilter}
                  onValueChange={setMinistryFilter}
                  options={[{ value: "", label: "All ministries" }, ...ministryOptions]}
                />
              </div>

              {dateFilter || ministryFilter ? (
                <button
                  type="button"
                  onClick={() => {
                    setDateFilter("");
                    setMinistryFilter("");
                  }}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--state-danger)]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Clear filters
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <p className="text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                {filteredServices.length} of {services.length} services
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedServiceIds([]);
                  void servicesQuery.refetch();
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--action-primary-bg)]"
                aria-label="Refresh services"
              >
                <RefreshCw className={isRefreshingServices ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </button>

              {selectedServiceIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={deleteServicesMutation.isPending}
                  className="group inline-flex h-10 w-10 items-center justify-center rounded-md bg-transparent text-[var(--text-danger)] disabled:opacity-50"
                  aria-label={`Delete ${selectedServiceIds.length} selected service${selectedServiceIds.length === 1 ? "" : "s"}`}
                >
                  {deleteServicesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AnimatedTrashBinIcon />}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {showTableSkeleton ? (
          <ServicesListSkeleton />
        ) : filteredServices.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">No matching services</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
              Adjust your filters or add a new service for the coming Sunday.
            </p>
          </div>
        ) : (
          <div>
            <label className="flex min-h-11 items-center gap-3 border-b border-[var(--rule-default)] px-4 py-2.5 text-sm text-[var(--text-secondary)] min-[1200px]:hidden">
              <input
                ref={compactSelectionCheckboxRef}
                type="checkbox"
                checked={allFilteredServicesSelected}
                onChange={toggleFilteredServiceSelection}
                aria-label={`${selectionStateLabel}: select all filtered services`}
                className="ui-checkbox h-5 w-5"
              />
              <span>{selectedFilteredServiceCount > 0 ? `${selectedFilteredServiceCount} selected` : "Select all services"}</span>
            </label>
            <div className="ui-ledger-header hidden grid-cols-[56px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(100px,.65fr)_88px] gap-3 px-4 py-2.5 min-[1200px]:grid">
              <label className="flex items-center pr-4">
                <input
                  ref={selectionCheckboxRef}
                  type="checkbox"
                  checked={allFilteredServicesSelected}
                  onChange={toggleFilteredServiceSelection}
                  aria-label={`${selectionStateLabel}: select all filtered services`}
                  className="ui-checkbox h-5 w-5"
                />
              </label>
              <span>Service</span>
              <span>Template</span>
              <span>Status</span>
              <span />
            </div>
            <ul>
              {filteredServices.map((service, index) => {
                const isExpanded = expandedServiceId === service.id;
                const isEditing = editingServiceId === service.id;
                const isSelected = selectedServiceIds.includes(service.id);
                const followsExpandedService = index > 0 && filteredServices[index - 1]?.id === expandedServiceId;

                return (
                  <li
                    key={service.id}
                    className={`group ${followsExpandedService ? "border-t border-[var(--rule-default)]" : ""} ${
                      isExpanded
                        ? "relative before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[var(--action-primary-bg)]"
                        : isSelected
                        ? "border-b border-[var(--rule-default)] bg-[color:color-mix(in_srgb,var(--action-primary-bg)_8%,transparent)]"
                        : "border-b border-[var(--rule-default)] bg-transparent"
                    }`}
                  >
                    <div className="grid grid-cols-[36px_minmax(0,1fr)_88px] items-start gap-x-3 gap-y-2 px-4 py-4 min-[1200px]:grid-cols-[56px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(100px,.65fr)_88px] min-[1200px]:items-center">
                      <div className="pr-3 pt-0.5 min-[1200px]:pt-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleServiceSelection(service.id)}
                            aria-label={`Select ${service.dateLabel}`}
                            className="ui-checkbox h-5 w-5"
                          />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{service.dateLabel}</p>
                        <p className="mt-1 break-words text-sm text-[var(--text-secondary)] min-[1200px]:truncate">{service.ministryLabel}</p>
                        <div className="mt-3 flex flex-col items-start gap-1 text-xs text-[var(--text-muted)] min-[1200px]:hidden">
                          <span>{service.templateLabel}</span>
                          <span className="inline-flex items-center gap-1.5" style={{ color: getServiceStatusColor(service.status) }}>
                            <span
                              aria-hidden="true"
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: getServiceStatusColor(service.status) }}
                            />
                            {formatServiceStatus(service.status)}
                          </span>
                        </div>
                      </div>
                      <p className="hidden truncate text-sm text-[var(--text-secondary)] min-[1200px]:block">{service.templateLabel}</p>
                      <span className="hidden items-center gap-2 text-xs font-medium min-[1200px]:inline-flex" style={{ color: getServiceStatusColor(service.status) }}>
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: getServiceStatusColor(service.status) }}
                        />
                        {formatServiceStatus(service.status)}
                      </span>
                      <div className="services-row-actions col-start-3 row-start-1 flex justify-end gap-1 min-[1200px]:col-auto min-[1200px]:row-auto">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="ui-row-menu-trigger group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"
                              aria-label={`Actions for ${service.dateLabel}`}
                              title="Service actions"
                            >
                              <Menu className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" side="left" sideOffset={8} className="workspace-content-light w-40 ui-action-menu-content">
                            <DropdownMenuItem
                              onSelect={() => startEditingService(service)}
                              className="service-row-menu-action-edit ui-action-menu-item min-h-9 gap-2 px-2 !text-[var(--text-primary)] [&_svg]:!text-current focus:!text-[var(--text-accent)] focus:[&_svg]:!text-[var(--text-accent)] data-[highlighted]:!text-[var(--text-accent)] data-[highlighted]:[&_svg]:!text-[var(--text-accent)]"
                            >
                              <Edit3 className="h-3.5 w-3.5" /> Edit
                            </DropdownMenuItem>
                            {service.status === ServiceStatus.DRAFT ? (
                              <DropdownMenuItem
                                onSelect={() => markReadyMutation.mutate(service.id)}
                                disabled={markReadyMutation.isPending}
                                className="service-row-menu-action-edit ui-action-menu-item min-h-9 gap-2 px-2 !text-[var(--text-primary)] [&_svg]:!text-current focus:!text-[var(--text-accent)] focus:[&_svg]:!text-[var(--text-accent)] data-[highlighted]:!text-[var(--text-accent)] data-[highlighted]:[&_svg]:!text-[var(--text-accent)]"
                              >
                                {markReadyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Mark ready
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              onSelect={() => {
                                setPendingDeleteServiceIds([service.id]);
                                setDeleteConfirmOpen(true);
                              }}
                              className="service-row-menu-action-delete ui-action-menu-item ui-action-menu-item-danger min-h-9 gap-2 px-2 !text-[var(--text-primary)] [&_svg]:!text-current focus:!text-[var(--text-danger)] focus:[&_svg]:!text-[var(--text-danger)] data-[highlighted]:!text-[var(--text-danger)] data-[highlighted]:[&_svg]:!text-[var(--text-danger)]"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                          <button
                            type="button"
                            onClick={() => toggleExpandedService(service)}
                            aria-expanded={isExpanded}
                            className="services-row-expand inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] min-[1200px]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"
                            aria-label={isExpanded ? "Collapse service" : "Expand service"}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                      </div>
                    </div>
                    <AnimatePresence initial={false}>
                      {isExpanded ? (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                        >
                            {isEditing ? (
                              <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-end md:justify-between lg:px-6">
                              {isEditing ? (
                                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                                  <ProductionDatePicker
                                    label="Service date"
                                    value={editServiceDate}
                                    onValueChange={setEditServiceDate}
                                    className="w-full md:w-44"
                                    labelClassName="mb-1 block text-sm font-semibold text-[var(--text-primary)]"
                                    triggerClassName="bg-transparent"
                                  />
                                  <ProductionSelect
                                    label="Assigned ministry"
                                    value={editMinistryPresetCode}
                                    onValueChange={setEditMinistryPresetCode}
                                    options={ministryOptions}
                                    className="w-full md:w-52"
                                    labelClassName="mb-1 block text-sm font-semibold text-[var(--text-primary)]"
                                    triggerClassName="bg-transparent"
                                  />
                                </div>
                              ) : null}
                              </div>
                            ) : null}
                            <div className="px-4 py-4 lg:px-6">
                            {isEditing ? (
                              <div className="space-y-3">
                                <ServiceBlockEditor
                                  blocks={service.blocks}
                                  values={editBlockValues}
                                  servants={servantsQuery.data ?? []}
                                  onChange={setEditBlockValues}
                                />
                                <div className="flex flex-wrap justify-end gap-3 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingServiceId(null);
                                    }}
                                    className="ui-btn-cancel pressable inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-semibold"
                                  >
                                    <X className="h-4 w-4" />
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={submitEditForm}
                                    disabled={updateServiceMutation.isPending}
                                    className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--action-primary-bg)] px-4 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60"
                                  >
                                    {updateServiceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save changes
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <ReadOnlyServiceDetails service={service} servants={servantsQuery.data ?? []} />
                            )}
                            </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <Dialog open={createModalOpen} onOpenChange={(open) => !open && setCreateModalOpen(false)}>
        {createModalOpen ? (
          <DialogContent className="flex max-h-[calc(100dvh-1rem)] max-w-6xl flex-col overflow-hidden p-0 sm:max-h-[90dvh]">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--rule-default)] px-4 py-3 sm:px-5 sm:py-4">
              <div>
                <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Create Worship Service</DialogTitle>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  aria-label="Close create service modal"
                  title="Close"
                  className="pressable inline-flex h-10 w-10 items-center justify-center rounded-lg border-0 bg-transparent text-[var(--text-primary)] hover:border-0 hover:bg-transparent hover:text-[var(--text-primary)] active:border-0 active:bg-transparent active:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              <TemplateDefinedServiceFields
                form={createForm}
                errors={createErrors}
                ministryOptions={ministryOptions}
                onChange={setCreateForm}
                templateOptions={templateOptions}
                templates={serviceTemplatesQuery.data ?? []}
                servants={servantsQuery.data ?? []}
                songs={songsQuery.data ?? []}
              />
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--rule-default)] bg-[var(--surface-panel-elevated)] px-4 py-3 sm:gap-3 sm:px-5 sm:py-4">
              <button
                type="button"
                onClick={() => setCreateParserOpen(true)}
                aria-label="Parse text"
                title="Parse text"
                className="pressable inline-flex h-11 w-11 items-center justify-center gap-2 rounded-lg border border-[var(--border-default)] bg-transparent text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--action-primary-bg)] hover:bg-transparent hover:text-[var(--action-primary-bg)] active:border-[var(--action-primary-bg)] active:bg-transparent active:text-[var(--action-primary-bg)] sm:w-auto sm:px-3"
              >
                <WandSparkles className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Parse text</span>
              </button>
              <button
                type="button"
                onClick={submitCreateForm}
                aria-label="Create service"
                title="Create service"
                disabled={
                  createServiceMutation.isPending
                  || serviceTemplatesQuery.isLoading
                  || !templateOptions.some((option) => option.value === createForm.templateType)
                }
                className="pressable inline-flex h-11 w-11 items-center justify-center gap-2 rounded-lg bg-[var(--action-primary-bg)] text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60 sm:w-auto sm:px-4"
              >
                {createServiceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                <span className="hidden sm:inline">Create Service</span>
              </button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={createModalOpen && createParserOpen} onOpenChange={(open) => !open && setCreateParserOpen(false)}>
        {createModalOpen && createParserOpen ? (
          <DialogContent className="max-w-2xl">
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Parse Text Fields</DialogTitle>
              <button
                type="button"
                onClick={() => setCreateParserOpen(false)}
                aria-label="Close text parser"
                title="Close"
                className="pressable inline-flex h-10 w-10 items-center justify-center rounded-lg border-0 bg-transparent text-[var(--text-primary)] hover:border-0 hover:bg-transparent hover:text-[var(--text-primary)] active:border-0 active:bg-transparent active:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <textarea
              value={createParserText}
              onChange={(event) => setCreateParserText(event.target.value)}
              rows={14}
              className="parse-text-fields-input mt-4 w-full resize-none overflow-y-auto rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-4 py-3 font-mono text-sm leading-6 text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateParserOpen(false)}
                className="ui-btn-cancel pressable inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={applyCreateParser}
                disabled={!createParserText.trim()}
                className="pressable inline-flex items-center gap-2 rounded-lg bg-[var(--action-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60"
              >
                <WandSparkles className="h-4 w-4" />
                Apply to form
              </button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => !open && closeDeleteConfirm()}>
        {deleteConfirmOpen ? (
          <DialogContent className="max-w-md">
            <button
              type="button"
              onClick={closeDeleteConfirm}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label="Close delete confirmation"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <DialogTitle className="pr-12 text-xl font-semibold text-[var(--text-primary)]">
              Delete {deleteServiceIds.length} service{deleteServiceIds.length === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              This will permanently remove the selected worship service records from the workspace.
            </DialogDescription>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => deleteServicesMutation.mutate(deleteServiceIds)}
                disabled={deleteServicesMutation.isPending}
                className="pressable inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:border-transparent hover:bg-[var(--state-danger)] hover:text-[var(--action-primary-ink)] active:border-transparent active:bg-[var(--state-danger)] active:text-[var(--action-primary-ink)] disabled:opacity-60"
              >
                {deleteServicesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleteServiceIds.length === 1 ? "Delete service" : "Delete Selected"}
              </button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <PAPToastViewport dismissToast={dismissToast} toasts={toasts} />
    </div>
  );
}

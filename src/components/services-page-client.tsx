"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Edit3, ExternalLink, Loader2, Plus, RefreshCcw, Save, Trash2, WandSparkles, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  apiFetch,
  type CreateServantPayload,
  type CreateServicePayload,
  type EditableSettingsPresetRecord,
  type ServiceRecord,
  type ServiceTemplatePresetRecord,
  type SongRecord,
  type ServantRecord,
  type UpdateServicePayload,
} from "@/lib/api-client";
import { analyzeServiceText } from "@/lib/service-text-analysis";
import {
  ASSIGNED_MINISTRY_OPTIONS,
  buildBibleGatewayUrl,
  getDefaultNextServiceSunday,
  inferAssignedMinistryFromName,
  mapAssignedMinistryToLegacyMinistryName,
  PLEDGE_TYPE_OPTIONS,
  SERVICE_HYMNAL_ROLES,
  SERVICE_SERVANT_ROLES,
  type AssignedMinistry,
  type PledgeType,
  type ServiceHymnalRole,
  type ServiceServantRole,
  type ServiceTemplateType,
} from "@/lib/service-records";
import { ServiceStatus } from "@/lib/service-constants";
import { formatServantDisplayName, normalizeServantName, normalizeServantNameForComparison } from "@/lib/servants";
import { PAPToastViewport, usePAPToasts } from "@/features/pap/components/pap-toasts";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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

type PendingServiceSave = {
  action: "create" | "update";
  payload: CreateServicePayload | UpdateServicePayload;
  serviceId?: string;
};

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
  if (status === ServiceStatus.READY) return "var(--state-ready)";
  if (status === ServiceStatus.ARCHIVED) return "var(--state-idle)";
  return "var(--state-warning)";
}

function ServicesListSkeleton() {
  return (
    <div aria-label="Loading worship services" className="divide-y divide-[var(--rule-default)]" role="status">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={`service-skeleton-${index}`}
          className="grid grid-cols-[24px_minmax(0,1fr)_44px] items-start gap-3 px-4 py-4 lg:grid-cols-[24px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(100px,.65fr)_44px]"
        >
          <div className="h-5 w-5 animate-pulse rounded-[4px] bg-[var(--surface-panel-strong)]" />
          <div className="space-y-2">
            <div className="h-5 w-36 animate-pulse rounded bg-[var(--surface-panel-strong)]" />
            <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-panel-strong)] lg:hidden" />
          </div>
          <div className="hidden h-5 w-28 animate-pulse rounded bg-[var(--surface-panel-strong)] lg:block" />
          <div className="hidden h-5 w-36 animate-pulse rounded bg-[var(--surface-panel-strong)] lg:block" />
          <div className="hidden h-5 w-16 animate-pulse rounded bg-[var(--surface-panel-strong)] lg:block" />
          <div className="h-10 w-10 animate-pulse rounded-md bg-[var(--surface-panel-strong)]" />
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

function buildMinistryOptions(records: EditableSettingsPresetRecord[] = []): MinistryOption[] {
  if (records.length > 0) {
    return records.filter((record) => record.active).map((record) => ({
      value: record.code,
      label: record.label,
      assignedMinistry: ASSIGNED_MINISTRY_OPTIONS.some((item) => item.value === record.code)
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

function isFirstSunday(templateType: string, templateOptions: TemplateOption[] = []) {
  return getSelectedTemplateType(templateType, templateOptions) === "FIRST_SUNDAY";
}

function normalizePersonNameForComparison(value: string) {
  return value.trim().toLocaleLowerCase();
}

function collectUnlistedServantNames(form: ServiceFormState, servants: ServantRecord[]) {
  const existingNames = new Set(servants.map((servant) => normalizeServantNameForComparison(servant.name)));
  const candidateNames = [
    ...Object.values(form.servantAssignments),
    ...form.offeringPeople,
  ];

  const missingNames = new Map<string, string>();

  for (const candidateName of candidateNames) {
    const baseName = normalizeServantName(candidateName);
    const comparisonName = normalizeServantNameForComparison(candidateName);

    if (!baseName || !comparisonName || existingNames.has(comparisonName) || missingNames.has(comparisonName)) {
      continue;
    }

    missingNames.set(comparisonName, baseName);
  }

  return [...missingNames.values()];
}

function hasDuplicateOfferingPeople(offeringPeople: [string, string]) {
  const [firstPerson, secondPerson] = offeringPeople.map(normalizePersonNameForComparison);
  return firstPerson.length > 0 && firstPerson === secondPerson;
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

function applyAnalysisToServiceForm(form: ServiceFormState, input: string) {
  const normalizedForm = normalizeServiceForm(form);
  const draft = analyzeServiceText(input);
  const nextForm: ServiceFormState = {
    ...normalizedForm,
    assignedMinistry: inferAssignedMinistryFromName(draft.ministryName),
    serviceDate: draft.serviceDate ?? normalizedForm.serviceDate,
    sermonVerse: draft.sermonVerse ?? normalizedForm.sermonVerse,
    bibleVerses: draft.bibleVerses.length > 0 ? draft.bibleVerses.map((entry) => entry.verse) : normalizedForm.bibleVerses,
    servantAssignments: { ...normalizedForm.servantAssignments },
    offeringPeople: [...normalizedForm.offeringPeople] as [string, string],
    hymnals: { ...normalizedForm.hymnals },
  };

  for (const assignment of draft.servantAssignments) {
    if (assignment.role === "OFFERING") {
      const firstEmptyIndex = nextForm.offeringPeople.findIndex((personName) => !personName.trim());
      if (firstEmptyIndex !== -1) {
        nextForm.offeringPeople[firstEmptyIndex] = assignment.personName;
      }
      continue;
    }
    nextForm.servantAssignments[assignment.role] = assignment.personName;
  }

  for (const hymnal of draft.hymnals) {
    nextForm.hymnals[hymnal.role] = hymnal.title;
  }

  return { draft, nextForm };
}

function UnlistedServantsModal({
  names,
  onClose,
  onConfirmAddAndSave,
  onSaveWithoutAdding,
  pending,
  selectedNames,
  setSelectedNames,
}: {
  names: string[];
  onClose: () => void;
  onConfirmAddAndSave: () => void;
  onSaveWithoutAdding: () => void;
  pending: boolean;
  selectedNames: string[];
  setSelectedNames: (names: string[]) => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Unlisted servants found</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[var(--text-secondary)]">
              Select which names should be added to Teams before this service is saved.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pressable inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] text-[var(--text-secondary)]"
            aria-label="Close add servants modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {names.map((name) => {
            const isSelected = selectedNames.includes(name);
            return (
              <label
                key={name}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                  isSelected
                    ? "border-[var(--action-primary-bg)] bg-[color:color-mix(in_srgb,var(--action-primary-bg)_12%,var(--surface-panel))] text-[var(--text-primary)]"
                    : "border-[var(--border-default)] bg-[var(--surface-panel-alt)] text-[var(--text-secondary)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() =>
                    setSelectedNames(
                      isSelected
                        ? selectedNames.filter((selectedName) => selectedName !== name)
                        : [...selectedNames, name],
                    )
                  }
                  className="ui-checkbox h-4 w-4"
                />
                <span className="min-w-0 flex-1 truncate">{name}</span>
              </label>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onSaveWithoutAdding}
            disabled={pending}
            className="pressable rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] disabled:opacity-60"
          >
            Save without adding
          </button>
          <button
            type="button"
            onClick={onConfirmAddAndSave}
            disabled={pending}
            className="pressable inline-flex items-center gap-2 rounded-lg bg-[var(--action-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add selected and save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ServantCombobox({
  onChange,
  options,
  placeholder,
  value,
}: {
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const filteredOptions = useMemo(() => {
    const normalizedValue = value.trim().toLocaleLowerCase();
    if (!normalizedValue) {
      return options;
    }

    return options.filter((option) => option.toLocaleLowerCase().includes(normalizedValue));
  }, [options, value]);

  return (
    <div
      className="relative"
      onBlur={() => {
        window.setTimeout(() => setOpen(false), 120);
      }}
    >
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
              setOpen(true);
              setHighlightedIndex(0);
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlightedIndex((currentIndex) => Math.min(currentIndex + 1, Math.max(filteredOptions.length - 1, 0)));
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightedIndex((currentIndex) => Math.max(currentIndex - 1, 0));
              return;
            }

            if (event.key === "Enter" && open && filteredOptions[highlightedIndex]) {
              event.preventDefault();
              onChange(filteredOptions[highlightedIndex]);
              setOpen(false);
              return;
            }

            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 pr-11 text-[var(--text-primary)]"
        />
        <button
          type="button"
          onClick={() => {
            setOpen((currentOpen) => !currentOpen);
            setHighlightedIndex(0);
          }}
          className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-panel)] hover:text-[var(--text-primary)]"
          aria-label={open ? "Hide servant suggestions" : "Show servant suggestions"}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open ? (
        <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-[var(--elevation-subtle)]">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const isActive = index === highlightedIndex;
              return (
                <button
                  key={`${option}-${index}`}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onChange(option);
                    setOpen(false);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                    isActive
                      ? "bg-[color:color-mix(in_srgb,var(--action-primary-bg)_18%,var(--surface-panel))] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-panel-alt)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="truncate">{option}</span>
                  {value === option ? <Check className="h-4 w-4 shrink-0" /> : null}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-sm text-[var(--text-secondary)]">No matching servants</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ServiceFormFields({
  errors,
  form,
  ministryOptions,
  onChange,
  servants,
  templateOptions,
  onInvalidOfferingDuplicate,
}: {
  errors: ServiceFormErrors;
  form: ServiceFormState;
  ministryOptions: MinistryOption[];
  onChange: (next: ServiceFormState) => void;
  servants: ServantRecord[];
  templateOptions: TemplateOption[];
  onInvalidOfferingDuplicate: () => void;
}) {
  const normalizedForm = normalizeServiceForm(form);
  const firstSunday = isFirstSunday(normalizedForm.templateType, templateOptions);
  const servantOptions = servants.map((servant) => formatServantDisplayName(servant));

  function updateOfferingPerson(index: 0 | 1, nextValue: string) {
    const nextOfferingPeople = [...normalizedForm.offeringPeople] as [string, string];
    nextOfferingPeople[index] = nextValue;

    if (hasDuplicateOfferingPeople(nextOfferingPeople)) {
      onInvalidOfferingDuplicate();
      return;
    }

    onChange({
      ...normalizedForm,
      offeringPeople: nextOfferingPeople,
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:items-start">
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Service and scripture</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
        <ProductionSelect
          label="Assigned Ministry"
          value={normalizedForm.assignedMinistry}
          onValueChange={(value) => onChange({ ...normalizedForm, assignedMinistry: value })}
          options={ministryOptions}
          triggerClassName="bg-[var(--surface-panel)]"
        />

        <label className="text-sm text-[var(--text-secondary)]">
          Date
          <input
            type="date"
            value={normalizedForm.serviceDate}
            onChange={(event) => onChange({ ...normalizedForm, serviceDate: event.target.value })}
            className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-[var(--text-primary)]"
          />
          {errors.serviceDate ? <p className="mt-1 text-xs text-[var(--state-danger)]">{errors.serviceDate}</p> : null}
        </label>

        <ProductionSelect
          label="Template"
          value={normalizedForm.templateType}
          onValueChange={(value) => onChange({
            ...normalizedForm,
            templateType: value,
            pledgeType: isFirstSunday(value, templateOptions) ? normalizedForm.pledgeType : "",
          })}
          options={templateOptions.map((option) => ({ value: option.value, label: option.label }))}
          triggerClassName="bg-[var(--surface-panel)]"
          className={firstSunday ? undefined : "md:col-span-2"}
          disabled={templateOptions.length === 0}
        />

        {firstSunday ? (
          <fieldset>
            <legend className="technical-label mb-1 block">Tipan / Pahayag</legend>
            <div className="inline-flex h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] p-1">
              {PLEDGE_TYPE_OPTIONS.map((option) => (
                <label key={option.value} className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="pledgeType"
                    value={option.value}
                    checked={form.pledgeType === option.value}
                    onChange={() => onChange({ ...normalizedForm, pledgeType: option.value })}
                    className="peer sr-only"
                  />
                  <span className="inline-flex h-8 w-full items-center justify-center rounded-md px-3 text-sm font-medium text-[var(--text-secondary)] peer-checked:bg-[var(--action-primary-bg)] peer-checked:text-[var(--action-primary-ink)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--border-focus)]">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
            {errors.pledgeType ? <p className="mt-1 text-xs text-[var(--state-danger)]">{errors.pledgeType}</p> : null}
          </fieldset>
        ) : null}

        {templateOptions.length === 0 ? (
          <p className="-mt-2 text-sm text-[var(--state-warning)] md:col-span-2">
            Add a saved template under <a href="/settings" className="font-semibold underline underline-offset-4">Settings → Templates</a> before creating a service.
          </p>
        ) : null}

      </div>

      <section className="border-t border-[var(--rule-default)] pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Bible verses</h3>
          <button
            type="button"
            onClick={() => onChange({ ...normalizedForm, bibleVerses: [...normalizedForm.bibleVerses, ""] })}
            className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add verse
          </button>
        </div>

        <label className="mt-4 block text-sm text-[var(--text-secondary)]">
          Sermon verse
          <div className="relative mt-1">
            <input
              type="text"
              value={normalizedForm.sermonVerse}
              onChange={(event) => onChange({ ...normalizedForm, sermonVerse: event.target.value })}
              placeholder="John 3:16"
              className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 pr-11 text-[var(--text-primary)]"
            />
            <a
              href={buildBibleGatewayUrl(normalizedForm.sermonVerse || "")}
              target="_blank"
              rel="noreferrer"
              aria-label="Open sermon verse in BibleGateway"
              title="Open sermon verse in BibleGateway"
              className={`absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-md ${
                normalizedForm.sermonVerse.trim()
                  ? "text-[var(--text-primary)] hover:bg-[var(--surface-panel-alt)]"
                  : "pointer-events-none text-[var(--text-secondary)] opacity-50"
              }`}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          {errors.sermonVerse ? <p className="mt-1 text-xs text-[var(--state-danger)]">{errors.sermonVerse}</p> : null}
        </label>

        <p className="mt-5 text-xs font-medium text-[var(--text-muted)]">Additional verses</p>
        <div className="mt-2 divide-y divide-[var(--rule-default)]">
          {normalizedForm.bibleVerses.map((verse, index) => (
            <div key={`verse-${index}`} className="py-3 first:pt-0 last:pb-0">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={verse}
                    onChange={(event) => {
                      const next = [...normalizedForm.bibleVerses];
                      next[index] = event.target.value;
                      onChange({ ...normalizedForm, bibleVerses: next });
                    }}
                    placeholder="Psalm 100:1-3"
                    className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 pr-11 text-sm text-[var(--text-primary)]"
                  />
                  <a
                    href={buildBibleGatewayUrl(verse || "")}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open Bible verse ${index + 1} in BibleGateway`}
                    title="Open in BibleGateway"
                    className={`absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-md ${
                      verse.trim()
                        ? "text-[var(--text-primary)] hover:bg-[var(--surface-panel-alt)]"
                        : "pointer-events-none text-[var(--text-secondary)] opacity-50"
                    }`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                {normalizedForm.bibleVerses.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...normalizedForm,
                        bibleVerses: normalizedForm.bibleVerses.filter((_, itemIndex) => itemIndex !== index),
                      })
                    }
                    aria-label={`Remove Bible verse ${index + 1}`}
                    title="Remove verse"
                    className="pressable inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-danger)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {errors.bibleVerses ? <p className="text-xs text-[var(--state-danger)]">{errors.bibleVerses}</p> : null}
        </div>
        </section>
      </div>

      <div className="space-y-6 lg:border-l lg:border-[var(--rule-default)] lg:pl-8">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">People and music</h2>
        </div>

      <section>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Servants</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {SERVICE_SERVANT_ROLES.filter((role) => firstSunday || !("firstSundayOnly" in role && role.firstSundayOnly)).map((role) => (
            <label
              key={role.value}
              className={`text-sm text-[var(--text-secondary)] ${role.value === "OFFERING" ? "md:col-span-2" : ""}`}
            >
              {role.label}
              {role.value === "OFFERING" ? (
                <div className="mt-1 grid grid-cols-2 gap-3">
                  {normalizedForm.offeringPeople.map((personName, index) => (
                    <div key={`offering-${index}`}>
                      <ServantCombobox
                        value={personName}
                        onChange={(nextValue) => updateOfferingPerson(index as 0 | 1, nextValue)}
                        options={servantOptions}
                        placeholder={index === 0 ? "Offering person 1" : "Offering person 2"}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-1">
                  <ServantCombobox
                    value={normalizedForm.servantAssignments[role.value]}
                    onChange={(nextValue) =>
                      onChange({
                        ...normalizedForm,
                        servantAssignments: {
                          ...normalizedForm.servantAssignments,
                          [role.value]: nextValue,
                        },
                      })
                    }
                    options={servantOptions}
                    placeholder={role.label}
                  />
                </div>
              )}
              {errors[role.value] ? <p className="mt-1 text-xs text-[var(--state-danger)]">{errors[role.value]}</p> : null}
            </label>
          ))}
        </div>
      </section>

      <section className="border-t border-[var(--rule-default)] pt-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Hymnals</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {SERVICE_HYMNAL_ROLES.filter((role) => firstSunday || !("firstSundayOnly" in role && role.firstSundayOnly)).map((role) => (
            <label key={role.value} className="text-sm text-[var(--text-secondary)]">
              {role.label}
              <input
                type="text"
                value={normalizedForm.hymnals[role.value]}
                onChange={(event) =>
                  onChange({
                    ...normalizedForm,
                    hymnals: {
                      ...normalizedForm.hymnals,
                      [role.value]: event.target.value,
                    },
                  })
                }
                className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-[var(--text-primary)]"
              />
              {errors[role.value] ? <p className="mt-1 text-xs text-[var(--state-danger)]">{errors[role.value]}</p> : null}
            </label>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
}

function TeamMemberPicker({
  members,
  personIds,
  onChange,
  disabled = false,
}: {
  members: ServantRecord[];
  personIds: string[];
  onChange: (personIds: string[]) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const workspaceMatch = pathname.match(/^\/w\/([^/]+)/);
  const teamsHref = workspaceMatch ? `/w/${workspaceMatch[1]}/teams` : "/teams";
  const availableMembers = filterTeamMembers(members, search, personIds);

  const selectMember = (personId: string) => {
    onChange(addTeamMember(personIds, personId));
    setSearch("");
    setIsOpen(true);
  };

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--text-secondary)]">Team members</span>
        <Link href={teamsHref} className="text-xs font-semibold text-[var(--text-accent)] underline-offset-2 hover:underline">Manage Teams</Link>
      </div>
      {personIds.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {personIds.map((personId) => {
            const member = members.find((candidate) => candidate.id === personId);
            return (
              <button
                key={personId}
                type="button"
                onClick={() => onChange(removeTeamMember(personIds, personId))}
                disabled={disabled}
                className="pressable inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-60"
                aria-label={`Remove ${member ? formatServantDisplayName(member) : "Team member"}`}
              >
                {member ? formatServantDisplayName(member) : "Unavailable member"} <span aria-hidden="true">×</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="relative mt-2">
        <input
          type="search"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search Teams…"
          disabled={disabled}
          aria-label="Search Team members"
          className="h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
        />
        {isOpen ? (
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-strong)] py-1 shadow-lg">
            {availableMembers.length ? availableMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => selectMember(member.id)}
                className="flex min-h-10 w-full items-center px-3 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-panel-alt)]"
              >
                {member.name}
              </button>
            )) : <p className="px-3 py-2 text-sm text-[var(--text-muted)]">No matching Team members.</p>}
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
  servants: ServantRecord[];
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <ProductionSelect label="Assigned Ministry" value={form.assignedMinistry} onValueChange={(assignedMinistry) => onChange({ ...form, assignedMinistry })} options={ministryOptions} triggerClassName="bg-[var(--surface-panel)]" />
        <label className="text-sm text-[var(--text-secondary)]">Date
          <input type="date" value={form.serviceDate} onChange={(event) => onChange({ ...form, serviceDate: event.target.value })} className="mt-1 h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 text-[var(--text-primary)]" />
          {errors.serviceDate ? <p className="mt-1 text-xs text-[var(--state-danger)]">{errors.serviceDate}</p> : null}
        </label>
        <ProductionSelect label="Template" value={form.templateType} onValueChange={updateTemplate} options={templateOptions.map((option) => ({ value: option.value, label: option.label }))} triggerClassName="bg-[var(--surface-panel)]" disabled={templateOptions.length === 0} />
      </div>
      {!template ? <p className="text-sm text-[var(--state-warning)]">Select a saved template to load its service fields.</p> : null}
      {template?.blocks.map((block) => (
        <section key={block.id} className="border-t border-[var(--rule-default)] pt-5">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{block.label}</h3>
          {block.kind === "TEXT" ? <label className="mt-3 block text-sm text-[var(--text-secondary)]">Notes<textarea value={String(form.templateBlockValues[block.id]?.text ?? "")} onChange={(event) => updateValue(block.id, "text", event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-[var(--text-primary)]" /></label> : <TeamMemberPicker members={servants} personIds={Array.isArray(form.templateBlockValues[block.id]?.personIds) ? form.templateBlockValues[block.id]?.personIds as string[] : []} onChange={(personIds) => updateValue(block.id, "personIds", personIds)} />}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {block.fieldDefinition.fields.map((field) => {
              const value = form.templateBlockValues[block.id]?.[field.key] ?? block.fieldDefaults?.[field.key] ?? (field.type === "checkbox" ? false : "");
              const label = <span>{field.label}{field.required ? <span className="text-[var(--state-danger)]"> *</span> : null}</span>;
              if (field.type === "checkbox") return <label key={field.key} className="flex min-h-11 items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={Boolean(value)} onChange={(event) => updateValue(block.id, field.key, event.target.checked)} />{label}</label>;
              if (field.type === "long_text") return <label key={field.key} className="block text-sm text-[var(--text-secondary)] md:col-span-2">{label}<textarea value={String(value)} onChange={(event) => updateValue(block.id, field.key, event.target.value)} placeholder={field.helpText} rows={3} className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-[var(--text-primary)]" /></label>;
              if (field.type === "single_select") return <label key={field.key} className="block text-sm text-[var(--text-secondary)]">{label}<select value={String(value)} onChange={(event) => updateValue(block.id, field.key, event.target.value)} className="mt-1 h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 text-[var(--text-primary)]"><option value="">Select…</option>{(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
              if (field.type === "person") return <label key={field.key} className="block text-sm text-[var(--text-secondary)]">{label}<select value={String(value)} onChange={(event) => updateValue(block.id, field.key, event.target.value)} className="mt-1 h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 text-[var(--text-primary)]"><option value="">Select person…</option>{servants.map((servant) => <option key={servant.id} value={servant.id}>{formatServantDisplayName(servant)}</option>)}</select></label>;
              if (field.type === "song") return <label key={field.key} className="block text-sm text-[var(--text-secondary)]">{label}<select value={String(value)} onChange={(event) => updateValue(block.id, field.key, event.target.value)} className="mt-1 h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 text-[var(--text-primary)]"><option value="">Select song…</option>{songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}</select></label>;
              return <label key={field.key} className="block text-sm text-[var(--text-secondary)]">{label}<input type={field.type === "duration" ? "number" : "text"} value={String(value)} onChange={(event) => updateValue(block.id, field.key, field.type === "duration" && event.target.value ? Number(event.target.value) : event.target.value)} placeholder={field.helpText} className="mt-1 h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 text-[var(--text-primary)]" /></label>;
            })}
          </div>
        </section>
      ))}
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
  servants: ServantRecord[];
  onChange: (values: ServiceBlockValues) => void;
}) {
  const updateValue = (blockId: string, nextValues: Record<string, unknown>) => {
    onChange({ ...values, [blockId]: nextValues });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--text-secondary)]">Edit the fields copied into this service. Template updates will not change this service.</p>
      {blocks.map((block) => {
        const blockValues = values[block.id] ?? (block.kind === "PERSON" ? { personIds: [] } : { text: "" });
        const personIds = Array.isArray(blockValues.personIds)
          ? blockValues.personIds.filter((id): id is string => typeof id === "string")
          : [];

        return (
          <section key={block.id} className="border-t border-[var(--rule-default)] pt-5">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">{block.label}</h4>
            {block.kind === "PERSON" ? (
              <TeamMemberPicker
                members={servants}
                personIds={personIds}
                onChange={(nextPersonIds) => updateValue(block.id, { personIds: nextPersonIds })}
              />
            ) : (
              <label className="mt-3 block text-sm text-[var(--text-secondary)]">
                Text
                <textarea
                  value={typeof blockValues.text === "string" ? blockValues.text : ""}
                  onChange={(event) => updateValue(block.id, { text: event.target.value })}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-[var(--text-primary)]"
                />
              </label>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ReadOnlyServiceDetails({ service, servants }: { service: ServiceListItem; servants: ServantRecord[] }) {
  const servantNameById = new Map(servants.map((servant) => [servant.id, formatServantDisplayName(servant)]));

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
              className="grid grid-cols-[2rem_minmax(10rem,0.8fr)_minmax(12rem,1.2fr)] items-start gap-3 rounded-md px-4 py-3 text-sm"
            >
              <span className="font-mono text-xs font-medium text-[var(--text-muted)]">{String(index + 1).padStart(2, "0")}</span>
              <span className="font-medium text-[var(--text-primary)]">{block.label}</span>
              <span className={`min-w-0 whitespace-pre-wrap break-words text-right ${value === "Not set" ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]"}`}>{value}</span>
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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createParserOpen, setCreateParserOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ServiceFormState>(() => createBlankServiceForm());
  const [createParserText, setCreateParserText] = useState("");
  const [createErrors, setCreateErrors] = useState<ServiceFormErrors>({});
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("");
  const [pendingServiceSave, setPendingServiceSave] = useState<PendingServiceSave | null>(null);
  const [unlistedServantNames, setUnlistedServantNames] = useState<string[]>([]);
  const [selectedUnlistedServantNames, setSelectedUnlistedServantNames] = useState<string[]>([]);

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: () => apiFetch<ServiceRecord[]>("/api/services"),
    ...(initialServices ? { initialData: initialServices } : {}),
    staleTime: 30_000,
  });
  const servantsQuery = useQuery({
    queryKey: ["servants", "all"],
    queryFn: () => apiFetch<ServantRecord[]>("/api/servants"),
    staleTime: 30_000,
  });
  const ministriesQuery = useQuery({
    queryKey: ["settings", "ministries"],
    queryFn: () => apiFetch<EditableSettingsPresetRecord[]>("/api/settings/ministries"),
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
        ministryLabel: ministryLabelByCode.get(service.ministryPresetCode ?? "")
          ?? formatAssignedMinistry(service.assignedMinistry, service.ministryName),
        templateLabel: templateLabelByCode.get(service.templatePresetCode ?? "")
          ?? formatTemplateLabel(service.templateType),
      })),
    [ministryLabelByCode, servicesQuery.data, templateLabelByCode]
  );
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesDate = !dateFilter || service.dateKey === dateFilter;
      const serviceMinistry = service.ministryPresetCode ?? service.assignedMinistry ?? "MIXED";
      const matchesMinistry = !ministryFilter || ministryFilter === serviceMinistry;
      return matchesDate && matchesMinistry;
    });
  }, [dateFilter, ministryFilter, services]);
  const expandedService = filteredServices.find((service) => service.id === expandedServiceId)
    ?? services.find((service) => service.id === expandedServiceId)
    ?? null;
  const showTableSkeleton = servicesQuery.isLoading || servicesQuery.isFetching || !servicesQuery.data;

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
      showToast("Service could not be created. Review the form and try again.");
    },
  });
  const songsQuery = useQuery({
    queryKey: ["songs"],
    queryFn: () => apiFetch<SongRecord[]>("/api/songs"),
    staleTime: 30_000,
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, blockValues }: { id: string; blockValues: ServiceBlockValues }) => {
      await Promise.all(
        Object.entries(blockValues).map(([blockId, values]) =>
          apiFetch(`/api/services/${id}/blocks/${blockId}/values`, {
            method: "PUT",
            body: JSON.stringify({ values }),
          })
        )
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
      setEditingServiceId(null);
    },
  });

  const createMissingServantsMutation = useMutation({
    mutationFn: (payload: CreateServantPayload[]) =>
      apiFetch<ServantRecord[]>("/api/servants", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["servants"] });
    },
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
      setDeleteConfirmOpen(false);
    },
  });

  function closeUnlistedServantsModal() {
    setPendingServiceSave(null);
    setUnlistedServantNames([]);
    setSelectedUnlistedServantNames([]);
  }

  function runPendingServiceSave(nextPendingSave: PendingServiceSave) {
    if (nextPendingSave.action === "create") {
      createServiceMutation.mutate(nextPendingSave.payload as CreateServicePayload);
      return;
    }

    if (!nextPendingSave.serviceId) {
      return;
    }

    updateServiceMutation.mutate({ id: nextPendingSave.serviceId, blockValues: editBlockValues });
  }

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
    const missingNames = action === "create" ? [] : collectUnlistedServantNames(form, servantsQuery.data ?? []);
    if (missingNames.length === 0) {
      if (action === "create") {
        createServiceMutation.mutate(payload);
        return;
      }

      if (!serviceId) {
        return;
      }

      updateServiceMutation.mutate({ id: serviceId, blockValues: editBlockValues });
      return;
    }

    setPendingServiceSave({ action, payload, serviceId });
    setUnlistedServantNames(missingNames);
    setSelectedUnlistedServantNames(missingNames);
  }

  function submitCreateForm() {
    prepareServiceSave("create", createForm);
  }

  function applyCreateParser() {
    const input = createParserText.trim();
    if (!input) return;

    const { nextForm } = applyAnalysisToServiceForm(createForm, input);
    setCreateForm(nextForm);
    setCreateErrors({});
    setCreateParserOpen(false);
  }

  function submitEditForm() {
    if (!expandedService) {
      return;
    }

    updateServiceMutation.mutate({ id: expandedService.id, blockValues: editBlockValues });
  }

  async function addSelectedServantsAndSave() {
    if (!pendingServiceSave) {
      return;
    }

    const nextPendingSave = pendingServiceSave;
    if (selectedUnlistedServantNames.length > 0) {
      try {
        await createMissingServantsMutation.mutateAsync(
          selectedUnlistedServantNames.map((name) => ({
            name,
            gender: null,
            group: null,
          })),
        );
      } catch {
        showToast("Failed to add selected servants to Teams.");
        return;
      }
    }

    closeUnlistedServantsModal();
    runPendingServiceSave(nextPendingSave);
  }

  function saveWithoutAddingServants() {
    if (!pendingServiceSave) {
      return;
    }

    const nextPendingSave = pendingServiceSave;
    closeUnlistedServantsModal();
    runPendingServiceSave(nextPendingSave);
  }

  function toggleServiceSelection(serviceId: string) {
    setSelectedServiceIds((current) =>
      current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId]
    );
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
  }

  return (
    <div className="services-page min-h-full space-y-6 py-1 lg:px-2">
      <section className="services-header flex flex-col gap-4 border-b border-[var(--border-default)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold leading-10 text-[var(--text-primary)]">
            Worship Services
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] md:text-base">
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

      <section className="services-register ui-surface-elevated w-full overflow-hidden">
        <div className="services-register-tools border-b border-[var(--rule-default)] px-4 py-4 sm:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Service register</h2>
              <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">
                {filteredServices.length} of {services.length} services
              </p>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end lg:justify-end">
              <label className="min-w-[180px] flex-1 text-xs font-medium text-[var(--text-muted)] sm:max-w-[220px]">
                <span className="mb-1.5 block">Service date</span>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className="block min-h-10 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </label>

              <div className="min-w-[180px] flex-1 sm:max-w-[220px]">
                <span className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Ministry</span>
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
                  className="inline-flex min-h-10 items-center justify-center px-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Clear filters
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setSelectedServiceIds([]);
                  void servicesQuery.refetch();
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel-alt)] hover:text-[var(--text-primary)]"
                aria-label="Refresh services"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>

              {selectedServiceIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={deleteServicesMutation.isPending}
                  className="pressable inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[var(--state-danger)] px-3 text-sm font-semibold text-[var(--text-danger)] disabled:opacity-50"
                >
                  {deleteServicesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete {selectedServiceIds.length}
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
            <div
              aria-hidden="true"
              className="hidden grid-cols-[24px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(100px,.65fr)_44px] gap-3 border-b border-[var(--rule-default)] px-4 py-2.5 font-mono text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)] lg:grid"
            >
              <span />
              <span>Service</span>
              <span>Template</span>
              <span>Sermon verse</span>
              <span>Status</span>
              <span />
            </div>
            <ul className="divide-y divide-[var(--rule-default)]">
              {filteredServices.map((service) => {
                const isExpanded = expandedServiceId === service.id;
                const isEditing = editingServiceId === service.id;
                const isSelected = selectedServiceIds.includes(service.id);

                return (
                  <li
                    key={service.id}
                    className={
                      isExpanded
                        ? "border-l-4 border-[var(--action-primary-bg)] bg-[color:color-mix(in_srgb,var(--action-primary-bg)_7%,transparent)]"
                        : isSelected
                        ? "bg-[color:color-mix(in_srgb,var(--action-primary-bg)_8%,transparent)]"
                        : "bg-transparent"
                    }
                  >
                    <div className="grid grid-cols-[24px_minmax(0,1fr)_44px] items-start gap-3 px-4 py-4 lg:grid-cols-[24px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(100px,.65fr)_44px] lg:items-center">
                      <div className="pt-0.5 lg:pt-0">
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
                        <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">{service.ministryLabel}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-muted)] lg:hidden">
                          <span>{service.templateLabel}</span>
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: getServiceStatusColor(service.status) }}
                            />
                            {formatServiceStatus(service.status)}
                          </span>
                        </div>
                        <p className="mt-2 truncate text-sm text-[var(--text-secondary)] lg:hidden">
                          {service.sermonVerse || "No sermon verse"}
                        </p>
                      </div>
                      <p className="hidden truncate text-sm text-[var(--text-secondary)] lg:block">{service.templateLabel}</p>
                      <p className="hidden truncate text-sm text-[var(--text-secondary)] lg:block">
                        {service.sermonVerse || "No sermon verse"}
                      </p>
                      <span className="hidden items-center gap-2 text-xs font-medium text-[var(--text-secondary)] lg:inline-flex">
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: getServiceStatusColor(service.status) }}
                        />
                        {formatServiceStatus(service.status)}
                      </span>
                      <div>
                          <button
                            type="button"
                            onClick={() => toggleExpandedService(service)}
                            aria-expanded={isExpanded}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--surface-panel-alt)]"
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
                          className="border-t border-[var(--border-default)] bg-[var(--surface-panel)]"
                        >
                            <div className="flex flex-col gap-3 border-b border-[var(--rule-default)] bg-[var(--surface-panel-strong)] px-4 py-4 md:flex-row md:items-center md:justify-between lg:px-6">
                              <div>
                                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                                  {isEditing ? "Edit service" : "Service flow"}
                                </h3>
                                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                  {isEditing ? "Edit the fields copied into this service." : `${service.blocks.length} ordered blocks`}
                                </p>
                              </div>

                              {isEditing ? (
                                <div className="flex flex-wrap items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingServiceId(null);
                                    }}
                                    className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border-default)] px-4 text-sm font-semibold text-[var(--text-secondary)]"
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
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditingService(service)}
                                  className="pressable inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]"
                                >
                                  <Edit3 className="h-4 w-4" />
                                  Edit service
                                </button>
                              )}
                            </div>
                            <div className="px-4 py-4 lg:px-6">
                            {isEditing ? (
                              <ServiceBlockEditor
                                blocks={service.blocks}
                                values={editBlockValues}
                                servants={servantsQuery.data ?? []}
                                onChange={setEditBlockValues}
                              />
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
          <DialogContent className="max-w-6xl overflow-hidden p-0">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--rule-default)] px-5 py-4">
              <div>
                <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Create worship service</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-[var(--text-secondary)]">
                  Defaults to next Sunday.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreateParserOpen(true)}
                  className="pressable inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]"
                >
                  <WandSparkles className="h-4 w-4" />
                  Parse text
                </button>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  aria-label="Close create service modal"
                  title="Close"
                  className="pressable inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] text-[var(--text-secondary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[calc(90vh-10rem)] overflow-y-auto px-5 py-5">
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

            <div className="flex justify-end border-t border-[var(--rule-default)] bg-[var(--surface-panel-strong)] px-5 py-4">
              <button
                type="button"
                onClick={submitCreateForm}
                disabled={
                  createServiceMutation.isPending
                  || serviceTemplatesQuery.isLoading
                  || !templateOptions.some((option) => option.value === createForm.templateType)
                }
                className="pressable inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--action-primary-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60"
              >
                {createServiceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Service
              </button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={createModalOpen && createParserOpen} onOpenChange={(open) => !open && setCreateParserOpen(false)}>
        {createModalOpen && createParserOpen ? (
          <DialogContent className="max-w-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Paste service participants</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-[var(--text-secondary)]">
                  Fill the service form from pasted text.
                </DialogDescription>
              </div>
              <button
                type="button"
                onClick={() => setCreateParserOpen(false)}
                aria-label="Close text parser"
                title="Close"
                className="pressable inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] text-[var(--text-secondary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <textarea
              value={createParserText}
              onChange={(event) => setCreateParserText(event.target.value)}
              rows={14}
              placeholder="Paste WS PARTICIPANTS text here..."
              className="mt-4 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-4 py-3 font-mono text-sm leading-6 text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateParserOpen(false)}
                className="pressable rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyCreateParser}
                disabled={!createParserText.trim()}
                className="pressable inline-flex items-center gap-2 rounded-lg bg-[var(--action-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60"
              >
                <WandSparkles className="h-4 w-4" />
                Parse Into Form
              </button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => !open && setDeleteConfirmOpen(false)}>
        {deleteConfirmOpen ? (
          <DialogContent className="max-w-md">
            <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">
              Delete {selectedServiceIds.length} service{selectedServiceIds.length === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              This will permanently remove the selected worship service records from the workspace.
            </DialogDescription>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="pressable rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteServicesMutation.mutate(selectedServiceIds)}
                disabled={deleteServicesMutation.isPending}
                className="pressable inline-flex items-center gap-2 rounded-lg bg-[var(--state-danger)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deleteServicesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete Selected
              </button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      {pendingServiceSave ? (
        <UnlistedServantsModal
          names={unlistedServantNames}
          onClose={closeUnlistedServantsModal}
          onConfirmAddAndSave={addSelectedServantsAndSave}
          onSaveWithoutAdding={saveWithoutAddingServants}
          pending={createMissingServantsMutation.isPending}
          selectedNames={selectedUnlistedServantNames}
          setSelectedNames={setSelectedUnlistedServantNames}
        />
      ) : null}

      <PAPToastViewport dismissToast={dismissToast} toasts={toasts} />
    </div>
  );
}

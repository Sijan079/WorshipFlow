"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Edit3, ExternalLink, Loader2, Plus, RefreshCcw, Save, Trash2, WandSparkles, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiFetch,
  type CreateServicePayload,
  type ServiceRecord,
  type ServantRecord,
  type UpdateServicePayload,
} from "@/lib/api-client";
import { analyzeServiceText } from "@/lib/service-text-analysis";
import {
  ASSIGNED_MINISTRY_OPTIONS,
  buildBibleGatewayUrl,
  formatOfferingPeople,
  getDefaultNextServiceSunday,
  inferAssignedMinistryFromName,
  mapAssignedMinistryToLegacyMinistryName,
  parseOfferingPeople,
  PLEDGE_TYPE_OPTIONS,
  SERVICE_HYMNAL_ROLES,
  SERVICE_SERVANT_ROLES,
  SERVICE_TEMPLATE_OPTIONS,
  type AssignedMinistry,
  type PledgeType,
  type ServiceHymnalRole,
  type ServiceServantRole,
  type ServiceTemplateType,
} from "@/lib/service-records";
import { ServiceStatus } from "@/lib/service-constants";
import { formatServantDisplayName } from "@/lib/servants";
import { PAPToastViewport, usePAPToasts } from "@/features/pap/components/pap-toasts";

type ServiceFormState = {
  assignedMinistry: AssignedMinistry;
  serviceDate: string;
  sermonVerse: string;
  templateType: ServiceTemplateType;
  pledgeType: PledgeType | "";
  bibleVerses: string[];
  servantAssignments: Record<ServiceServantRole, string>;
  offeringPeople: [string, string];
  hymnals: Record<ServiceHymnalRole, string>;
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

const FIRST_SUNDAY_SERVANT_ROLES = new Set<ServiceServantRole>(["PLEDGE_READER"]);
const FIRST_SUNDAY_HYMNAL_ROLES = new Set<ServiceHymnalRole>(["SONG_OF_HYMNS"]);
const SERVICE_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatServiceDate(dateString: string) {
  return SERVICE_DATE_FORMATTER.format(new Date(dateString));
}

function ServicesTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead className="bg-[var(--color-brand-panel-strong)]">
          <tr className="text-left">
            <th className="w-12 px-4 py-3" />
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Date</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Ministry</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Sermon Verse</th>
            <th className="w-14 px-2 py-3" />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, index) => (
            <tr key={`service-skeleton-${index}`} className="border-t border-[var(--color-brand-border)] bg-[var(--color-brand-panel)]">
              <td className="px-4 py-4 align-top">
                <div className="h-5 w-5 animate-pulse rounded-[4px] bg-[var(--color-brand-panel-alt)]" />
              </td>
              <td className="px-4 py-4 align-top">
                <div className="h-5 w-28 animate-pulse rounded bg-[var(--color-brand-panel-alt)]" />
              </td>
              <td className="px-4 py-4 align-top">
                <div className="h-5 w-24 animate-pulse rounded bg-[var(--color-brand-panel-alt)]" />
              </td>
              <td className="px-4 py-4 align-top">
                <div className="h-5 w-36 animate-pulse rounded bg-[var(--color-brand-panel-alt)]" />
              </td>
              <td className="px-2 py-3 align-top">
                <div className="h-9 w-9 animate-pulse rounded-md bg-[var(--color-brand-panel-alt)]" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

function createFormFromService(service: ServiceRecord): ServiceFormState {
  const blank = createBlankServiceForm();

  for (const assignment of service.servantAssignments ?? []) {
    if (assignment.role === "OFFERING") {
      blank.offeringPeople = parseOfferingPeople(assignment.personName);
      continue;
    }
    blank.servantAssignments[assignment.role as ServiceServantRole] = assignment.personName;
  }

  for (const hymnal of service.hymnals ?? []) {
    blank.hymnals[hymnal.role as ServiceHymnalRole] = hymnal.title;
  }

  return normalizeServiceForm({
    assignedMinistry: (service.assignedMinistry ?? "LADIES") as AssignedMinistry,
    serviceDate: new Date(service.serviceDate).toISOString().slice(0, 10),
    sermonVerse: service.sermonVerse ?? "",
    templateType: (service.templateType ?? "REGULAR") as ServiceTemplateType,
    pledgeType: (service.pledgeType ?? "") as PledgeType | "",
    bibleVerses: service.bibleVerses?.length ? service.bibleVerses.map((entry) => entry.verse) : [""],
    servantAssignments: blank.servantAssignments,
    offeringPeople: blank.offeringPeople,
    hymnals: blank.hymnals,
  });
}

function isFirstSunday(templateType: ServiceTemplateType) {
  return templateType === "FIRST_SUNDAY";
}

function normalizePersonNameForComparison(value: string) {
  return value.trim().toLocaleLowerCase();
}

function hasDuplicateOfferingPeople(offeringPeople: [string, string]) {
  const [firstPerson, secondPerson] = offeringPeople.map(normalizePersonNameForComparison);
  return firstPerson.length > 0 && firstPerson === secondPerson;
}

function validateServiceForm(form: ServiceFormState): ServiceFormErrors {
  if (hasDuplicateOfferingPeople(normalizeServiceForm(form).offeringPeople)) {
    return {
      OFFERING: "Offering servants cannot be the same person.",
    };
  }

  return {};
}

function buildServicePayload(form: ServiceFormState): CreateServicePayload {
  const normalizedForm = normalizeServiceForm(form);
  type ServiceServantAssignmentPayload = NonNullable<CreateServicePayload["servantAssignments"]>[number];
  const servantAssignments = SERVICE_SERVANT_ROLES
    .filter((role) => isFirstSunday(normalizedForm.templateType) || !FIRST_SUNDAY_SERVANT_ROLES.has(role.value))
    .reduce<ServiceServantAssignmentPayload[]>((assignments, role) => {
      if (role.value === "OFFERING") {
        const personName = formatOfferingPeople(normalizedForm.offeringPeople);
        if (personName) {
          assignments.push({ role: role.value, personName });
        }

        return assignments;
      }

      assignments.push({
        role: role.value,
        personName: normalizedForm.servantAssignments[role.value].trim(),
      });

      return assignments;
    }, []);

  return {
    serviceDate: new Date(normalizedForm.serviceDate).toISOString(),
    assignedMinistry: normalizedForm.assignedMinistry,
    sermonVerse: normalizedForm.sermonVerse.trim(),
    status: ServiceStatus.DRAFT,
    templateType: normalizedForm.templateType,
    pledgeType: isFirstSunday(normalizedForm.templateType) ? (normalizedForm.pledgeType || null) : null,
    bibleVerses: normalizedForm.bibleVerses
      .map((verse, index) => ({ verse: verse.trim(), order: index }))
      .filter((entry) => entry.verse.length > 0),
    servantAssignments,
    hymnals: SERVICE_HYMNAL_ROLES
      .filter((role) => isFirstSunday(normalizedForm.templateType) || !FIRST_SUNDAY_HYMNAL_ROLES.has(role.value))
      .map((role) => ({
        role: role.value,
        title: normalizedForm.hymnals[role.value].trim(),
      })),
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
                      ? "bg-[color:color-mix(in_srgb,var(--color-brand-accent)_18%,var(--surface-panel))] text-[var(--text-primary)]"
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

function ServiceFormFields({
  errors,
  form,
  onChange,
  servants,
  onInvalidOfferingDuplicate,
}: {
  errors: ServiceFormErrors;
  form: ServiceFormState;
  onChange: (next: ServiceFormState) => void;
  servants: ServantRecord[];
  onInvalidOfferingDuplicate: () => void;
}) {
  const normalizedForm = normalizeServiceForm(form);
  const firstSunday = isFirstSunday(normalizedForm.templateType);
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
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-[var(--text-secondary)]">
          Assigned Ministry
          <select
            value={normalizedForm.assignedMinistry}
            onChange={(event) => onChange({ ...normalizedForm, assignedMinistry: event.target.value as AssignedMinistry })}
            className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-[var(--text-primary)]"
          >
            {ASSIGNED_MINISTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

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

        <label className="text-sm text-[var(--text-secondary)]">
          Template
          <select
            value={normalizedForm.templateType}
            onChange={(event) =>
              onChange({
                ...normalizedForm,
                templateType: event.target.value as ServiceTemplateType,
                pledgeType: event.target.value === "FIRST_SUNDAY" ? normalizedForm.pledgeType : "",
              })
            }
            className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-[var(--text-primary)]"
          >
            {SERVICE_TEMPLATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-[var(--text-secondary)]">
          Sermon Verse
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
      </div>

      {firstSunday ? (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4">
          <p className="technical-label">PLEDGE OF FAITH / COVENANT</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {PLEDGE_TYPE_OPTIONS.map((option) => (
              <label key={option.value} className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <input
                  type="radio"
                  name="pledgeType"
                  value={option.value}
                  checked={form.pledgeType === option.value}
                  onChange={() => onChange({ ...normalizedForm, pledgeType: option.value })}
                />
                {option.label}
              </label>
            ))}
          </div>
          {errors.pledgeType ? <p className="mt-2 text-xs text-[var(--state-danger)]">{errors.pledgeType}</p> : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="technical-label">BIBLE VERSES</p>
          <button
            type="button"
            onClick={() => onChange({ ...normalizedForm, bibleVerses: [...normalizedForm.bibleVerses, ""] })}
            className="pressable rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]"
          >
            Add verse
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {normalizedForm.bibleVerses.map((verse, index) => (
            <div key={`verse-${index}`} className="rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] p-3">
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
                    className="pressable rounded-md border border-[var(--border-default)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {errors.bibleVerses ? <p className="text-xs text-[var(--state-danger)]">{errors.bibleVerses}</p> : null}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4">
        <p className="technical-label">SERVANTS</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">Pick from Teams suggestions or type a one-off name manually.</p>
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
      </div>

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4">
        <p className="technical-label">HYMNALS</p>
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
      </div>
    </div>
  );
}

function ReadOnlyServiceDetails({ service }: { service: ServiceRecord }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4">
          <p className="technical-label">DATE</p>
          <p className="mt-2 text-sm font-semibold text-[var(--color-brand-ink)]">
            {formatServiceDate(service.serviceDate)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4">
          <p className="technical-label">MINISTRY</p>
          <p className="mt-2 text-sm font-semibold text-[var(--color-brand-ink)]">
            {formatAssignedMinistry(service.assignedMinistry, service.ministryName)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4">
          <p className="technical-label">SERMON VERSE</p>
          <p className="mt-2 text-sm font-semibold text-[var(--color-brand-ink)]">
            {service.sermonVerse || "Not set"}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4">
          <p className="technical-label">TEMPLATE</p>
          <p className="mt-2 text-sm font-semibold text-[var(--color-brand-ink)]">
            {formatTemplateLabel(service.templateType)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="technical-label">BIBLE VERSES</p>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {service.bibleVerses?.length ?? 0} linked
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {service.bibleVerses?.length ? (
              service.bibleVerses.map((entry) => (
                <a
                  key={entry.id}
                  href={buildBibleGatewayUrl(entry.verse)}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm text-[var(--color-brand-ink)] hover:border-[var(--color-brand-accent)]"
                >
                  {entry.verse}
                </a>
              ))
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">No Bible verses yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4">
          <p className="technical-label">SERVANTS</p>
          <div className="mt-3 space-y-2">
            {SERVICE_SERVANT_ROLES.filter((role) =>
              service.templateType === "FIRST_SUNDAY" || !("firstSundayOnly" in role && role.firstSundayOnly)
            ).map((role) => {
              const value = role.value === "OFFERING"
                ? service.servantAssignments?.find((entry) => entry.role === role.value)?.personName
                : service.servantAssignments?.find((entry) => entry.role === role.value)?.personName;
              return (
                <div key={role.value} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-[var(--color-text-secondary)]">{role.label}</span>
                  <span className="text-right font-medium text-[var(--color-brand-ink)]">{value || "Not set"}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4">
          <p className="technical-label">HYMNALS</p>
          <div className="mt-3 space-y-2">
            {SERVICE_HYMNAL_ROLES.filter((role) =>
              service.templateType === "FIRST_SUNDAY" || !("firstSundayOnly" in role && role.firstSundayOnly)
            ).map((role) => {
              const value = service.hymnals?.find((entry) => entry.role === role.value)?.title;
              return (
                <div key={role.value} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-[var(--color-text-secondary)]">{role.label}</span>
                  <span className="text-right font-medium text-[var(--color-brand-ink)]">{value || "Not set"}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {service.templateType === "FIRST_SUNDAY" ? (
        <section className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4">
          <p className="technical-label">FIRST SUNDAY DETAILS</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2">
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                Pledge
              </span>
              <p className="mt-1 text-sm font-medium text-[var(--color-brand-ink)]">
                {service.pledgeType === "PLEDGE_OF_FAITH" ? "Pledge of Faith" : service.pledgeType === "COVENANT" ? "Covenant" : "Not set"}
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

type ServiceListItem = ServiceRecord & {
  dateKey: string;
  dateLabel: string;
  ministryLabel: string;
};

export default function ServicesPageClient({ initialServices = [] }: { initialServices?: ServiceRecord[] }) {
  const queryClient = useQueryClient();
  const { dismissToast, showToast, toasts } = usePAPToasts();
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createParserOpen, setCreateParserOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ServiceFormState>(() => createBlankServiceForm());
  const [createParserText, setCreateParserText] = useState("");
  const [editForm, setEditForm] = useState<ServiceFormState>(() => createBlankServiceForm());
  const [createErrors, setCreateErrors] = useState<ServiceFormErrors>({});
  const [editErrors, setEditErrors] = useState<ServiceFormErrors>({});
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const [ministryFilter, setMinistryFilter] = useState<AssignedMinistry | "">("");

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: () => apiFetch<ServiceRecord[]>("/api/services"),
    initialData: initialServices,
    staleTime: 30_000,
  });
  const servantsQuery = useQuery({
    queryKey: ["servants", "all"],
    queryFn: () => apiFetch<ServantRecord[]>("/api/servants"),
    staleTime: 30_000,
  });

  const services = useMemo<ServiceListItem[]>(
    () =>
      (servicesQuery.data ?? []).map((service) => ({
        ...service,
        dateKey: new Date(service.serviceDate).toISOString().slice(0, 10),
        dateLabel: formatServiceDate(service.serviceDate),
        ministryLabel: formatAssignedMinistry(service.assignedMinistry, service.ministryName),
      })),
    [servicesQuery.data]
  );
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesDate = !dateFilter || service.dateKey === dateFilter;
      const assignedMinistry = (service.assignedMinistry ?? "MIXED") as AssignedMinistry;
      const matchesMinistry = !ministryFilter || ministryFilter === assignedMinistry;
      return matchesDate && matchesMinistry;
    });
  }, [dateFilter, ministryFilter, services]);
  const expandedService = filteredServices.find((service) => service.id === expandedServiceId)
    ?? services.find((service) => service.id === expandedServiceId)
    ?? null;
  const showTableSkeleton = servicesQuery.isLoading || servicesQuery.isFetching;

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
      setEditForm(createFormFromService(service));
      setEditErrors({});
      setCreateModalOpen(false);
      setCreateForm(createBlankServiceForm());
      setCreateErrors({});
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateServicePayload }) =>
      apiFetch<ServiceRecord>(`/api/services/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
      setEditingServiceId(null);
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

  function submitCreateForm() {
    const errors = validateServiceForm(createForm);
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) {
      if (errors.OFFERING) {
        showToast(errors.OFFERING);
      }
      return;
    }

    createServiceMutation.mutate(buildServicePayload(createForm));
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

    const errors = validateServiceForm(editForm);
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) {
      if (errors.OFFERING) {
        showToast(errors.OFFERING);
      }
      return;
    }

    updateServiceMutation.mutate({
      id: expandedService.id,
      payload: buildServicePayload(editForm),
    });
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
    setEditForm(createFormFromService(service));
    setEditErrors({});
  }

  function startEditingService(service: ServiceRecord) {
    setExpandedServiceId(service.id);
    setEditingServiceId(service.id);
    setEditForm(createFormFromService(service));
    setEditErrors({});
  }

  return (
    <main className="min-h-full space-y-8 py-3 lg:px-2">
      <section className="space-y-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold leading-tight text-[var(--color-brand-ink)] md:text-5xl">
            Worship Services
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)] md:text-lg md:leading-8">
            Build each worship service as a clear record first, then let the template drive the approved block flow.
          </p>
        </div>
      </section>

      <section className="production-panel mx-auto max-w-7xl overflow-hidden">
        <div className="border-b border-[var(--color-brand-border)] px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="min-w-[180px] max-w-[220px] flex-1 text-sm text-[var(--color-text-secondary)]">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className="block w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-3 py-2 text-[var(--color-brand-ink)]"
                />
              </label>

              <label className="min-w-[180px] max-w-[220px] flex-1 text-sm text-[var(--color-text-secondary)]">
                <select
                  value={ministryFilter}
                  onChange={(event) => setMinistryFilter(event.target.value as AssignedMinistry | "")}
                  className="block w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-3 py-2 text-[var(--color-brand-ink)]"
                >
                  <option value="">All ministries</option>
                  {ASSIGNED_MINISTRY_OPTIONS.map((option) => (
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
                onClick={() => void servicesQuery.refetch()}
                className="rounded-md border border-[var(--color-brand-border)] p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-panel-alt)] hover:text-[var(--color-brand-ink)]"
                aria-label="Refresh services"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={selectedServiceIds.length === 0 || deleteServicesMutation.isPending}
                className={`pressable inline-flex h-10 w-10 items-center justify-center rounded-lg border p-0 disabled:opacity-50 ${
                  selectedServiceIds.length > 0
                    ? "border-[#F43F5E] bg-[#F43F5E] text-white"
                    : "border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] text-[var(--color-brand-ink)]"
                }`}
                aria-label="Delete selected services"
                title="Delete selected services"
              >
                {deleteServicesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="pressable inline-flex items-center gap-2 rounded-lg border border-[var(--color-brand-accent)] bg-[var(--color-brand-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-ink)]"
              >
                <Plus className="h-4 w-4" />
                Add Service
              </button>
            </div>
          </div>
        </div>

        {showTableSkeleton ? (
          <ServicesTableSkeleton />
        ) : filteredServices.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <h3 className="text-lg font-semibold text-[var(--color-brand-ink)]">No matching services</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--color-text-secondary)]">
              Adjust your filters or add a new service for the coming Sunday.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-[var(--color-brand-panel-strong)]">
                <tr className="text-left">
                  <th className="w-12 px-4 py-3" />
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                    Date
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                    Ministry
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                    Sermon Verse
                  </th>
                  <th className="w-14 px-2 py-3" />
                </tr>
              </thead>
                {filteredServices.map((service) => {
                  const isExpanded = expandedServiceId === service.id;
                  const isEditing = editingServiceId === service.id;
                  const isSelected = selectedServiceIds.includes(service.id);

                  return (
                    <tbody key={service.id}>
                      <tr
                        className={
                          isExpanded
                            ? "bg-[color:color-mix(in_srgb,#0EA5E9_14%,var(--color-brand-panel))]"
                            : isSelected
                            ? "bg-[color:color-mix(in_srgb,var(--color-brand-accent)_12%,var(--color-brand-panel))]"
                            : "bg-[var(--color-brand-panel)]"
                        }
                      >
                        <td className="px-4 py-4 align-top">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleServiceSelection(service.id)}
                            aria-label={`Select ${service.dateLabel}`}
                            className="h-5 w-5 appearance-none rounded-[4px] border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] align-middle shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] checked:border-[var(--color-brand-accent)] checked:bg-[var(--color-brand-accent)] checked:bg-[image:linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.02))] focus:outline-none focus:ring-2 focus:ring-[rgba(139,92,246,0.35)]"
                          />
                        </td>
                        <td className="px-4 py-4 align-top text-sm font-semibold text-[var(--color-brand-ink)]">
                          {service.dateLabel}
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-[var(--color-text-secondary)]">
                          {service.ministryLabel}
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-[var(--color-text-secondary)]">
                          {service.sermonVerse || "No sermon verse"}
                        </td>
                        <td className="px-2 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => toggleExpandedService(service)}
                            className="rounded-md border border-[var(--color-brand-border)] p-2 text-[var(--color-brand-ink)] hover:bg-[var(--color-brand-panel-alt)]"
                            aria-label={isExpanded ? "Collapse service" : "Expand service"}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="bg-[color:color-mix(in_srgb,#0EA5E9_14%,var(--color-brand-panel))]">
                          <td colSpan={6} className="border-t border-[var(--color-brand-border)] px-5 py-5">
                            <div className="space-y-5">
                              <div className="flex flex-col gap-3 border-b border-[var(--color-brand-border)] pb-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <p className="technical-label">{isEditing ? "EDIT SERVICE" : "SERVICE DETAILS"}</p>
                                  <h3 className="mt-2 text-lg font-semibold text-[var(--color-brand-ink)]">
                                    {service.dateLabel}
                                  </h3>
                                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                    {service.ministryLabel}
                                    {" / "}
                                    {formatTemplateLabel(service.templateType)}
                                  </p>
                                </div>

                                {isEditing ? (
                                  <div className="flex flex-wrap items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingServiceId(null);
                                        setEditForm(createFormFromService(service));
                                        setEditErrors({});
                                      }}
                                      className="pressable inline-flex h-10 box-border items-center justify-center gap-2 rounded-lg border border-[#F43F5E] bg-[#F43F5E] px-4 text-sm font-semibold leading-none text-white"
                                    >
                                      <X className="h-4 w-4" />
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={submitEditForm}
                                      disabled={updateServiceMutation.isPending}
                                      className="pressable inline-flex h-10 box-border items-center justify-center gap-2 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-4 text-sm font-semibold leading-none text-[var(--color-brand-ink)] disabled:opacity-60"
                                    >
                                      {updateServiceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                      Save Changes
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEditingService(service)}
                                    className="pressable inline-flex items-center gap-2 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-ink)]"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                    Edit Service
                                  </button>
                                )}
                              </div>

                              {isEditing ? (
                                <ServiceFormFields
                                  form={editForm}
                                  errors={editErrors}
                                  onChange={setEditForm}
                                  onInvalidOfferingDuplicate={() => showToast("Offering servants cannot be the same person.")}
                                  servants={servantsQuery.data ?? []}
                                />
                              ) : (
                                <ReadOnlyServiceDetails service={service} />
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  );
                })}
              
            </table>
          </div>
        )}
      </section>

      {createModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-overlay-strong)] p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-brand-ink)]">Create worship service</h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  The date defaults to the Sunday of the following week.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreateParserOpen(true)}
                  className="pressable inline-flex items-center gap-2 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-3 py-2 text-sm font-semibold text-[var(--color-brand-ink)]"
                >
                  <WandSparkles className="h-4 w-4" />
                  Parse Text
                </button>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="pressable rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)]"
                >
                  Close
                </button>
              </div>
            </div>

            <ServiceFormFields
              form={createForm}
              errors={createErrors}
              onChange={setCreateForm}
              onInvalidOfferingDuplicate={() => showToast("Offering servants cannot be the same person.")}
              servants={servantsQuery.data ?? []}
            />

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={submitCreateForm}
                disabled={createServiceMutation.isPending}
                className="pressable inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-ink)] disabled:opacity-60"
              >
                {createServiceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Service
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createModalOpen && createParserOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--surface-overlay-strong)] p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="technical-label">PARSE SERVICE TEXT</p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--color-brand-ink)]">Paste WS participants text</h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  This fills the add-service form with date, ministry, verses, servants, and hymnals.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateParserOpen(false)}
                className="pressable rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)]"
              >
                Close
              </button>
            </div>

            <textarea
              value={createParserText}
              onChange={(event) => setCreateParserText(event.target.value)}
              rows={14}
              placeholder="Paste WS PARTICIPANTS text here..."
              className="mt-4 w-full rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-4 py-3 font-mono text-sm leading-6 text-[var(--color-brand-ink)] outline-none focus:border-[var(--color-brand-accent)]"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateParserOpen(false)}
                className="pressable rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-ink)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyCreateParser}
                disabled={!createParserText.trim()}
                className="pressable inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-ink)] disabled:opacity-60"
              >
                <WandSparkles className="h-4 w-4" />
                Parse Into Form
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-overlay-strong)] p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-5 shadow-sm">
            <p className="technical-label">DELETE SELECTED</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--color-brand-ink)]">
              Delete {selectedServiceIds.length} service{selectedServiceIds.length === 1 ? "" : "s"}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              This will permanently remove the selected worship service records from the workspace.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="pressable rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-ink)]"
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
          </div>
        </div>
      ) : null}

      <PAPToastViewport dismissToast={dismissToast} toasts={toasts} />
    </main>
  );
}

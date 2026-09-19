"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import {
  Check,
  ChevronRight,
  CircleAlert,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductionSelect } from "@/components/ui/production-select";
import { PAPToastViewport, usePAPToasts } from "@/features/pap/components/pap-toasts";

const COLOR_TOKENS = [
  { label: "Canvas", token: "--surface-canvas" },
  { label: "Panel", token: "--surface-panel" },
  { label: "Subtle", token: "--surface-panel-alt" },
  { label: "Inactive", token: "--surface-panel-strong" },
  { label: "Primary", token: "--action-primary-bg" },
  { label: "Primary hover", token: "--action-primary-bg-hover" },
  { label: "Success", token: "--state-success" },
  { label: "Warning", token: "--state-warning" },
  { label: "Danger", token: "--state-danger" },
] as const;

const TYPE_SAMPLES = [
  { label: "Page title", className: "ui-page-title", text: "Sunday Worship Service" },
  { label: "Section heading", className: "text-xl font-semibold text-[var(--text-primary)]", text: "Service details" },
  { label: "Body", className: "text-base text-[var(--text-secondary)]", text: "Prepare every production detail before the service begins." },
  { label: "Metadata", className: "ui-technical-label", text: "Ready · September 13 · 9:00 AM" },
] as const;

const TABLE_ROWS = [
  { service: "Sunday Worship Service", template: "Sunday Main", status: "Ready", selected: false },
  { service: "Ladies Ministry", template: "Ladies Fellowship", status: "Draft", selected: true },
  { service: "Youth Worship Service", template: "Youth Night", status: "Draft", selected: false },
] as const;

function GallerySection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`gallery-${title.toLowerCase().replaceAll(" ", "-")}`} className="border-t border-[var(--rule-default)] py-8 first:border-t-0 first:pt-0">
      <div className="mb-5 max-w-2xl">
        <h2 id={`gallery-${title.toLowerCase().replaceAll(" ", "-")}`} className="text-xl font-semibold text-[var(--text-primary)]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TokenSwatch({ label, token }: { label: string; token: string }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel)]">
      <div className="h-20 border-b border-[var(--border-default)]" style={{ backgroundColor: `var(${token})` } as CSSProperties} />
      <div className="p-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
        <code className="mt-1 block text-xs text-[var(--text-muted)]">{token}</code>
      </div>
    </div>
  );
}

function ToastPreview({ tone, children }: { tone: "info" | "success" | "error"; children: ReactNode }) {
  const toneClass = tone === "success"
    ? "border-[color-mix(in_oklab,var(--state-success)_32%,var(--border-default))] bg-[var(--state-success-soft)]"
    : tone === "error"
      ? "border-[color-mix(in_oklab,var(--state-danger)_32%,var(--border-default))] bg-[var(--state-danger-soft)]"
      : "border-[var(--border-default)] bg-[var(--surface-panel)]";
  const Icon = tone === "success" ? Check : tone === "error" ? CircleAlert : Info;
  const iconClass = tone === "success" ? "text-[var(--state-success)]" : tone === "error" ? "text-[var(--state-danger)]" : "text-[var(--text-accent)]";

  return (
    <div className={`rounded-[var(--radius-control)] border p-3 shadow-[var(--elevation-subtle)] ${toneClass}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} aria-hidden="true" />
        <p className="text-sm font-semibold leading-5 text-[var(--text-primary)]">{children}</p>
      </div>
    </div>
  );
}

export default function DesignSystemGalleryClient() {
  const [selectValue, setSelectValue] = useState("ready");
  const [modal, setModal] = useState<"edit" | "delete" | null>(null);
  const { dismissToast, showToast, toasts } = usePAPToasts();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="ui-page-header flex flex-col gap-4 border-b border-[var(--rule-default)] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ui-technical-label">Private visual reference</p>
          <h1 className="ui-page-title mt-1">Worship Flow Design System</h1>
          <p className="ui-page-description max-w-2xl">A live gallery of the tokens and operational components established by Services and Teams.</p>
        </div>
        <span className="w-fit rounded-[var(--radius-pill)] border border-[var(--border-default)] bg-[var(--surface-panel-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">tokens.css · current</span>
      </header>

      <main className="pt-8">
        <GallerySection title="Token palette" description="The semantic colors currently active inside the light operational workspace.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {COLOR_TOKENS.map((color) => <TokenSwatch key={color.token} {...color} />)}
          </div>
        </GallerySection>

        <GallerySection title="Typography" description="The hierarchy used for page headings, form sections, body copy, and technical metadata.">
          <div className="divide-y divide-[var(--rule-default)] border-y border-[var(--rule-default)]">
            {TYPE_SAMPLES.map((sample) => (
              <div key={sample.label} className="grid gap-2 py-5 md:grid-cols-[160px_minmax(0,1fr)] md:items-baseline">
                <span className="ui-technical-label">{sample.label}</span>
                <p className={sample.className}>{sample.text}</p>
              </div>
            ))}
          </div>
        </GallerySection>

        <GallerySection title="Buttons" description="Primary, secondary, cancel, destructive, icon-only, disabled, and compact action states.">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="ui-btn-primary pressable inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"><Plus className="h-4 w-4" />Create service</button>
            <button type="button" className="ui-btn-primary pressable inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"><Save className="h-4 w-4" />Save changes</button>
            <button type="button" className="ui-btn-cancel pressable inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold">Cancel</button>
            <button type="button" className="ui-btn-danger pressable inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"><Trash2 className="h-4 w-4" />Delete</button>
            <button type="button" aria-label="Assign servant" title="Assign servant" className="group inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:text-[var(--action-primary-bg)]"><UserPlus className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" /></button>
            <button type="button" disabled className="ui-btn-primary inline-flex items-center px-4 py-2 text-sm font-semibold opacity-50">Disabled</button>
          </div>
        </GallerySection>

        <GallerySection title="Form controls" description="Engraved text fields, inactive surfaces, multiline input, checkboxes, and the shared production dropdown.">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block text-sm text-[var(--text-secondary)]">Service name<input className="ui-field mt-1 w-full px-3 py-2 outline-none" defaultValue="Sunday Worship Service" /></label>
            <label className="block text-sm text-[var(--text-secondary)]">Inactive field<input className="ui-field ui-field-inactive mt-1 w-full px-3 py-2 outline-none" defaultValue="Ladies Ministry" /></label>
            <ProductionSelect label="Status" value={selectValue} onValueChange={setSelectValue} triggerClassName="bg-[var(--surface-panel-strong)]" options={[{ value: "draft", label: "Draft" }, { value: "ready", label: "Ready" }, { value: "live", label: "Live" }]} />
            <fieldset>
              <legend className="technical-label mb-1">Selection</legend>
              <div className="flex min-h-10 items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" className="ui-checkbox h-5 w-5" />Unchecked</label>
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" defaultChecked className="ui-checkbox h-5 w-5" />Checked</label>
              </div>
            </fieldset>
            <label className="block text-sm text-[var(--text-secondary)] md:col-span-2">Production notes<textarea className="ui-field mt-1 h-28 w-full resize-none px-3 py-2 outline-none" defaultValue="Confirm microphones, lyrics, and presentation cues before rehearsal." /></label>
          </div>
        </GallerySection>

        <GallerySection title="Operational table" description="The shared register, header, selected row, status treatment, checkbox, and row action menu.">
          <div className="ui-surface-elevated ui-operational-register">
            <div className="ui-register-toolbar flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-sm font-semibold text-[var(--text-primary)]">Service register</p><p className="mt-1 text-sm text-[var(--text-secondary)]">3 of 3 services</p></div>
              <button type="button" className="ui-btn-primary pressable inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4" />Create service</button>
            </div>
            <div className="ui-ledger-header grid grid-cols-[32px_minmax(0,1.4fr)_minmax(120px,.8fr)_100px_44px] items-center gap-3 px-4 py-3">
              <span /><span>Service</span><span>Template</span><span>Status</span><span />
            </div>
            <ul>
              {TABLE_ROWS.map((row) => (
                <li key={row.service} className="group ui-ledger-row" data-selected={row.selected}>
                  <div className="grid min-h-[var(--ledger-row-min-height)] grid-cols-[32px_minmax(0,1.4fr)_minmax(120px,.8fr)_100px_44px] items-center gap-3 px-4">
                    <input type="checkbox" defaultChecked={row.selected} aria-label={`Select ${row.service}`} className="ui-checkbox h-5 w-5" />
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-primary)]">{row.service}</p><p className="mt-1 text-xs text-[var(--text-muted)]">September 13 · 9:00 AM</p></div>
                    <p className="truncate text-sm text-[var(--text-secondary)]">{row.template}</p>
                    <span className="inline-flex w-fit items-center gap-2 text-sm font-medium text-[var(--text-secondary)]"><span className={`h-2 w-2 rounded-full ${row.status === "Ready" ? "bg-[var(--state-success)]" : "bg-[var(--state-idle)]"}`} />{row.status}</span>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild><button type="button" className="ui-row-menu-trigger opacity-100" aria-label={`Actions for ${row.service}`}><MoreHorizontal className="h-5 w-5" /></button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="left" sideOffset={8} className="workspace-content-light ui-action-menu-content w-40">
                        <DropdownMenuItem className="ui-action-menu-item"><Pencil className="h-4 w-4" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="ui-action-menu-item ui-action-menu-item-danger"><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </GallerySection>

        <GallerySection title="Modals" description="Open the current edit and delete dialog treatments, including their shared close and action rules.">
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setModal("edit")} className="ui-btn-secondary pressable inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"><Pencil className="h-4 w-4" />Open edit modal</button>
            <button type="button" onClick={() => setModal("delete")} className="ui-btn-danger pressable inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"><Trash2 className="h-4 w-4" />Open delete modal</button>
          </div>
        </GallerySection>

        <GallerySection title="Toasts" description="Static tone references plus buttons that invoke the live shared toast viewport.">
          <div className="grid gap-3 lg:grid-cols-3">
            <ToastPreview tone="info">Service draft has unsaved changes.</ToastPreview>
            <ToastPreview tone="success">Service saved successfully.</ToastPreview>
            <ToastPreview tone="error">Service could not be deleted.</ToastPreview>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => showToast("Review the service details before continuing.")} className="ui-btn-secondary pressable inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold"><Info className="h-4 w-4" />Show info</button>
            <button type="button" onClick={() => showToast("Service saved successfully.", "success")} className="ui-btn-secondary pressable inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold"><Check className="h-4 w-4" />Show success</button>
            <button type="button" onClick={() => showToast("Service could not be deleted.", "error")} className="ui-btn-secondary pressable inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold"><CircleAlert className="h-4 w-4" />Show error</button>
          </div>
        </GallerySection>
      </main>

      <Dialog open={modal === "edit"} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="max-w-lg">
          <div className="flex items-start justify-between gap-4"><div><DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Edit Service</DialogTitle><DialogDescription className="mt-1 text-sm text-[var(--text-secondary)]">Update the service details below.</DialogDescription></div><button type="button" onClick={() => setModal(null)} className="ui-modal-close" aria-label="Close edit modal"><X className="h-4 w-4" /></button></div>
          <div className="mt-5 space-y-4"><label className="block text-sm text-[var(--text-secondary)]">Service name<input className="ui-field ui-field-inactive mt-1 w-full px-3 py-2 outline-none" defaultValue="Sunday Worship Service" /></label><ProductionSelect label="Status" value={selectValue} onValueChange={setSelectValue} triggerClassName="bg-[var(--surface-panel-strong)]" options={[{ value: "draft", label: "Draft" }, { value: "ready", label: "Ready" }, { value: "live", label: "Live" }]} /></div>
          <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setModal(null)} className="ui-btn-cancel pressable min-h-11 px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={() => { setModal(null); showToast("Service saved successfully.", "success"); }} className="ui-btn-primary pressable inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">Save changes<ChevronRight className="h-4 w-4" /></button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "delete"} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="max-w-md">
          <button type="button" onClick={() => setModal(null)} className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)]" aria-label="Close delete modal"><X className="h-4 w-4" /></button>
          <DialogTitle className="pr-12 text-xl font-semibold text-[var(--text-primary)]">Delete service?</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">This permanently removes the service and its prepared production details.</DialogDescription>
          <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setModal(null)} className="ui-btn-cancel pressable min-h-11 px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={() => { setModal(null); showToast("Delete preview completed.", "success"); }} className="ui-btn-danger pressable inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"><Trash2 className="h-4 w-4" />Delete service</button></div>
        </DialogContent>
      </Dialog>

      <PAPToastViewport dismissToast={dismissToast} toasts={toasts} />
    </div>
  );
}

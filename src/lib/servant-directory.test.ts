import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ServantSchema,
  SERVANT_GENDER_OPTIONS,
  SERVANT_GROUP_OPTIONS,
  formatServantDisplayName,
  formatServantGroupLabel,
  formatServantGenderLabel,
  getServantInitials,
  normalizeServantName,
  normalizeServantNameForComparison,
} from "./servants.ts";
import { WORKSPACE_MODULES } from "./workspace-modules.ts";

export function runServantDirectoryTests() {
  assert.equal(WORKSPACE_MODULES.includes("teams" as never), true);

  assert.deepEqual(
    SERVANT_GROUP_OPTIONS.map((option) => option.value),
    ["PASTORS", "CHURCH_LEADERS", "MENS", "LADIES", "YOUTH", "TECH", "MUSIC"],
  );
  assert.deepEqual(
    SERVANT_GROUP_OPTIONS.map((option) => option.label),
    ["Pastors", "Church Leaders", "Men's", "Ladies'", "Youth", "Tech", "Music"],
  );
  assert.deepEqual(
    SERVANT_GENDER_OPTIONS.map((option) => option.value),
    ["MALE", "FEMALE"],
  );
  assert.equal(formatServantGroupLabel("CHURCH_LEADERS"), "Church Leaders");
  assert.equal(formatServantGenderLabel("FEMALE"), "Female");
  assert.equal(formatServantGenderLabel(null), "Not set");
  assert.equal(formatServantGroupLabel(null), "Not set");
  assert.equal(formatServantDisplayName({ name: "John Cruz", gender: "MALE", group: "TECH" }), "Bro. John Cruz");
  assert.equal(formatServantDisplayName({ name: "Maria Santos", gender: "FEMALE", group: "LADIES" }), "Sis. Maria Santos");
  assert.equal(formatServantDisplayName({ name: "Joel Reyes", gender: "MALE", group: "PASTORS" }), "Ptr. Joel Reyes");
  assert.equal(formatServantDisplayName({ name: "Ptr. Joel Reyes", gender: "MALE", group: "PASTORS" }), "Ptr. Joel Reyes");
  assert.equal(formatServantDisplayName({ name: "Sis. Abby", gender: "FEMALE", group: "LADIES" }), "Sis. Abby");
  assert.equal(formatServantDisplayName({ name: "Ramon Cruz", gender: null, group: null }), "Ramon Cruz");
  assert.equal(normalizeServantName("  Bro.   John   Cruz  "), "John Cruz");
  assert.equal(normalizeServantName("Ptr. Joel Reyes"), "Joel Reyes");
  assert.equal(normalizeServantNameForComparison("Sis. Maria Santos"), "maria santos");
  assert.equal(getServantInitials("Artsijan Yu"), "AY");
  assert.equal(getServantInitials("Romeo de Guzman III"), "RG");
  assert.equal(getServantInitials("Sis. Abigail"), "A");

  const valid = ServantSchema.safeParse({
    name: "  Sis. Abigail  ",
    gender: "FEMALE",
    group: "LADIES",
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.name, "Sis. Abigail");
  }

  const invalid = ServantSchema.safeParse({
    name: " ",
    gender: "FEMALE",
    group: "LADIES",
  });
  assert.equal(invalid.success, false);

  const nameOnly = ServantSchema.safeParse({
    name: "  Joel Reyes  ",
  });
  assert.equal(nameOnly.success, true);
  if (nameOnly.success) {
    assert.equal(nameOnly.data.name, "Joel Reyes");
    assert.equal(nameOnly.data.gender, undefined);
    assert.equal(nameOnly.data.group, undefined);
  }

  const teamsPagePath = join(process.cwd(), "src", "app", "(workspace)", "teams", "page.tsx");
  assert.equal(existsSync(teamsPagePath), true);

  const teamsPageSource = readFileSync(teamsPagePath, "utf8");
  assert.match(teamsPageSource, /TeamsPageClient/);

  const teamsClientSource = readFileSync(join(process.cwd(), "src", "components", "teams-page-client.tsx"), "utf8");
  const globalsSource = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
  const bulkAssignModal = teamsClientSource.slice(
    teamsClientSource.indexOf("function BulkAssignModal"),
    teamsClientSource.indexOf("function ServantModal"),
  );
  const servantModal = teamsClientSource.slice(
    teamsClientSource.indexOf("function ServantModal"),
    teamsClientSource.indexOf("export default function TeamsPageClient"),
  );
  const teamsDeleteConfirmationModal = teamsClientSource.slice(
    teamsClientSource.indexOf("open={pendingDeleteServantIds.length > 0}"),
    teamsClientSource.indexOf("</Dialog>", teamsClientSource.indexOf("open={pendingDeleteServantIds.length > 0}")),
  );
  const rowMenuEdgeStyles = globalsSource.slice(
    globalsSource.indexOf(".ui-row-menu-trigger-edge {"),
    globalsSource.indexOf("@media (hover: hover)", globalsSource.indexOf(".ui-row-menu-trigger-edge {")),
  );
  assert.match(teamsClientSource, /ui-page-header/);
  assert.match(teamsClientSource, /ui-page-title/);
  assert.match(teamsClientSource, /ui-page-description/);
  assert.match(teamsClientSource, /teams-register ui-surface-elevated ui-operational-register/);
  assert.match(teamsClientSource, /teams-register-tools ui-register-toolbar/);
  assert.match(teamsClientSource, /ui-ledger-header/);
  assert.match(teamsClientSource, /ui-ledger-row/);
  assert.match(teamsClientSource, /ui-field/);
  assert.match(teamsClientSource, /ui-modal-close/);
  assert.match(teamsClientSource, /ui-row-menu-trigger/);
  assert.match(teamsClientSource, /ui-action-menu-content/);
  assert.match(teamsClientSource, /ui-action-menu-item-danger/);
  assert.match(teamsClientSource, /<DropdownMenu modal=\{false\}>/);
  assert.doesNotMatch(teamsClientSource, /window\.confirm/);
  assert.match(
    teamsClientSource,
    /text-sm leading-6 text-\[var\(--text-secondary\)\] md:text-base[\s\S]*?\{servants\.length\} of \{totalServantCount\} servants/,
  );
  assert.match(teamsClientSource, /function AnimatedTrashBinIcon\(\)/);
  assert.match(teamsClientSource, /function AnimatedAssignIcon\(\)/);
  assert.match(teamsClientSource, /aria-label=\{`Assign \$\{selectedServantIds\.length\} selected servant/);
  assert.match(teamsClientSource, /aria-label=\{`Delete \$\{selectedServantIds\.length\} selected servant/);
  assert.match(teamsClientSource, /group-hover:-translate-y-0\.5 group-hover:scale-105/);
  assert.match(teamsClientSource, /group-hover:text-\[var\(--action-primary-bg\)\]/);
  assert.match(teamsDeleteConfirmationModal, /<DialogContent className="max-w-md">/);
  assert.match(teamsDeleteConfirmationModal, /className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-md text-\[var\(--text-secondary\)\] hover:text-\[var\(--text-primary\)\]"/);
  assert.match(teamsDeleteConfirmationModal, /DialogDescription className="mt-2 text-sm leading-6 text-\[var\(--text-secondary\)\]"/);
  assert.match(teamsDeleteConfirmationModal, /hover:border-transparent hover:bg-\[var\(--state-danger\)\] hover:text-\[var\(--action-primary-ink\)\]/);
  assert.match(teamsDeleteConfirmationModal, /active:border-transparent active:bg-\[var\(--state-danger\)\] active:text-\[var\(--action-primary-ink\)\]/);
  assert.match(teamsDeleteConfirmationModal, /pendingDeleteServantIds.length === 1 \? "Delete servant" : "Delete Selected"/);
  assert.match(bulkAssignModal, /<DialogContent className="max-w-lg">/);
  assert.equal((bulkAssignModal.match(/triggerClassName="bg-\[var\(--surface-panel-strong\)\]/g) ?? []).length, 2);
  assert.doesNotMatch(bulkAssignModal, />\s*Cancel\s*<\/button>/);
  assert.match(bulkAssignModal, /aria-label="Close bulk assign modal"/);
  assert.match(servantModal, /<DialogContent className="max-w-lg">/);
  assert.match(servantModal, /ui-field ui-field-inactive/);
  assert.equal((servantModal.match(/triggerClassName="bg-\[var\(--surface-panel-strong\)\]/g) ?? []).length, 2);
  assert.doesNotMatch(servantModal, />\s*Cancel\s*<\/button>/);
  assert.match(servantModal, /aria-label="Close servant modal"/);
  assert.match(teamsClientSource, /const SERVANT_LONG_PRESS_MS = 1_000;/);
  assert.match(teamsClientSource, /closest\("button, input, a, \[role='menuitem'\], \[data-row-interactive\]"\)/);
  assert.match(teamsClientSource, /onPointerDown=\{\(event\) => startServantLongPress\(event, servant\.id\)\}/);
  assert.match(teamsClientSource, /onPointerMove=\{moveServantLongPress\}/);
  assert.match(teamsClientSource, /onPointerUp=\{clearServantLongPress\}/);
  assert.match(teamsClientSource, /onPointerCancel=\{clearServantLongPress\}/);
  assert.match(teamsClientSource, /className="ui-row-menu-trigger ui-row-menu-trigger-edge"/);
  assert.match(teamsClientSource, /data-row-interactive="true"/);
  assert.match(teamsClientSource, /className="flex h-10 w-10 items-center justify-center justify-self-center"/);
  assert.match(teamsClientSource, /className="ui-checkbox h-5 w-5"/);
  assert.match(globalsSource, /\.ui-row-menu-trigger-edge \{/);
  assert.match(rowMenuEdgeStyles, /border: 0;/);
  assert.match(globalsSource, /min-height: var\(--ledger-row-min-height\);/);
  assert.doesNotMatch(rowMenuEdgeStyles, /background:/);
  assert.doesNotMatch(rowMenuEdgeStyles, /border-left/);

  const shellSource = readFileSync(join(process.cwd(), "src", "components", "workspace-shell.tsx"), "utf8");
  assert.match(shellSource, /href: "\/teams"/);
}

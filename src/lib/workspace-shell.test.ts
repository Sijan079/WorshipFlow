import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function runWorkspaceShellTests() {
  const shell = readFileSync(join(process.cwd(), "src", "components", "workspace-shell.tsx"), "utf8");
  const settings = readFileSync(join(process.cwd(), "src", "components", "settings-page-client.tsx"), "utf8");
  const settingsAdmin = readFileSync(join(process.cwd(), "src", "components", "settings-admin-sections.tsx"), "utf8");
  const settingsRoutes = readFileSync(join(process.cwd(), "src", "lib", "settings-routes.ts"), "utf8");
  const ministriesRoute = readFileSync(join(process.cwd(), "src", "app", "api", "settings", "ministries", "[id]", "route.ts"), "utf8");
  const servantGroupsRoute = readFileSync(join(process.cwd(), "src", "app", "api", "settings", "servant-groups", "[id]", "route.ts"), "utf8");
  const session = readFileSync(join(process.cwd(), "src", "app", "api", "auth", "session", "route.ts"), "utf8");

  for (const removedCopy of ["Back to Services", "CURRENT SERVICE", "Notes", "Messages", "Activity"]) {
    assert.doesNotMatch(shell, new RegExp(removedCopy));
  }

  assert.match(shell, /DropdownMenuTrigger/);
  assert.match(shell, /aria-label="Open account menu"/);
  assert.match(shell, /workspace-nav-surface/);
  assert.match(shell, /workspace-content-light/);
  assert.match(shell, /href: "\/song-formatter\/upload"/);
  assert.doesNotMatch(shell, /href: "\/songs\/upload"/);
  assert.match(shell, /workspace-shell min-h-screen bg-white/);
  assert.doesNotMatch(shell, /lg:col-span-2 lg:row-start-1 lg:flex/);
  assert.match(shell, /workspace-nav-surface workspace-rail[\s\S]*BrandLogo/);
  assert.match(shell, /workspace-nav-account[\s\S]*<nav/);
  assert.match(shell, /accountRole/);
  assert.match(shell, /avatarUrl/);
  assert.match(shell, /avatarFailed/);
  assert.match(shell, /alertCount/);
  assert.match(shell, /workspace-rail[^>]*overflow-x-hidden/);
  assert.match(shell, /workspace-rail[^>]*lg:sticky lg:top-0/);
  assert.match(shell, /min-h-0 flex-1 overflow-y-auto overflow-x-hidden/);
  assert.match(session, /avatarUrl/);
  assert.match(session, /identity_data/);
  assert.match(session, /workspaceSlug/);
  assert.match(session, /role/);
  assert.doesNotMatch(settings, /Templates define the structure of new services/);
  assert.doesNotMatch(settings, /Workspace controls/);
  assert.doesNotMatch(settings, /Settings <span aria-hidden="true"/);
  assert.doesNotMatch(settings, /<h2[^>]*>General<\/h2>/);
  assert.doesNotMatch(settings, /Manage workspace identity and service defaults/);
  assert.doesNotMatch(settings, /aria-label="Refresh settings"/);
  assert.match(settings, /grid-cols-\[2rem_2\.75rem_minmax\(0,1fr\)_minmax\(10rem,13rem\)_2\.75rem\]/);
  assert.doesNotMatch(settings, /min-w-0 border-t border-\[var\(--border-default\)\]/);
  assert.doesNotMatch(settings, /usage-billing/);
  assert.doesNotMatch(settings, /settings-panel-workspace/);
  assert.doesNotMatch(settings, /Usage &amp; billing|Usage & billing/);
  assert.match(settings, /flat/);
  assert.doesNotMatch(settings, /grid-cols-\[2rem_minmax\(0,1fr\)_2\.75rem\]/);
  assert.match(settings, /grid-cols-\[2rem_2\.75rem_minmax\(0,1fr\)_minmax\(10rem,13rem\)_2\.75rem\]/);
  assert.doesNotMatch(settings, /String\(index \+ 1\)\.padStart\(2, "0"\)<\/span>/);
  assert.match(shell, /workspace-nav-link[\s\S]*text-white/);
  assert.doesNotMatch(settings, /query\.data\?\.slug/);
  assert.doesNotMatch(settings, /StatusPill active=\{draft\.active\}/);
  assert.match(settings, /lg:grid-cols-\[220px_minmax\(0,1fr\)\]/);
  assert.match(settings, /Settings section navigation/);
  assert.match(settings, /aria-orientation="vertical"/);
  assert.doesNotMatch(settingsAdmin, /This name identifies the production workspace/);
  assert.match(settingsAdmin, /Workspace identity/);
  assert.doesNotMatch(settingsAdmin, /sm:grid-cols-2/);
  assert.match(settings, /<div className="min-w-0">/);
  assert.match(settingsAdmin, /editingName/);
  assert.match(settings, /label="New template"/);
  assert.match(settingsAdmin, /type=\"file\"/);
  assert.match(settingsAdmin, /logoDataUrl/);
  assert.match(settings, /editingId/);
  assert.match(settingsRoutes, /allowDefaultDelete\?: boolean/);
  assert.match(settingsRoutes, /record\.isDefault && !config\.allowDefaultDelete/);
  assert.match(ministriesRoute, /allowDefaultDelete: true/);
  assert.match(servantGroupsRoute, /allowDefaultDelete: true/);
}

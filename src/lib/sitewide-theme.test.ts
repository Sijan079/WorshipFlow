import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const landingSource = read("src/app/page.tsx");
const loginSource = read("src/app/login/page.tsx");
const loginFormSource = read("src/components/login-form.tsx");
const carouselSource = read("src/components/landing-signal-carousel.tsx");
assert.match(landingSource, /text-\[#a875ff\]/i);
assert.match(loginSource, /text-\[#a875ff\]/i);
assert.match(loginFormSource, /text-\[#cdb5ef\]/i);
assert.match(carouselSource, /Purple Editorial Signal/);

const serviceBuilderSource = read("src/components/service-builder-client.tsx");
const recentConversions = serviceBuilderSource.slice(
  serviceBuilderSource.indexOf("Recent Conversions") - 300,
  serviceBuilderSource.indexOf("Recent Conversions") + 100,
);
assert.match(recentConversions, /text-\[var\(--text-primary\)\]/);
assert.doesNotMatch(recentConversions, /<h3[^>]*text-\[var\(--color-focus\)\]/);

const dashboardSource = read("src/components/worship-service-planner-client.tsx");
assert.doesNotMatch(dashboardSource, /technical-label text-\[var\(--text-accent\)\]/);
assert.doesNotMatch(
  dashboardSource,
  /var\(--color-(?:brand-ink|text-secondary|text-muted)\)/,
  "dashboard content must use the scoped semantic light-theme tokens",
);
assert.match(dashboardSource, /dashboard-page[^\n]*text-\[var\(--text-primary\)\]/);

const servicesSource = read("src/components/services-page-client.tsx");
assert.doesNotMatch(
  servicesSource,
  /var\(--color-(?:accent-ink|brand-accent|brand-border|brand-ink|brand-panel|brand-panel-alt|text-secondary)\)/,
  "services and its dialogs must use the scoped semantic light-theme tokens",
);

const dialogSource = read("src/components/ui/dialog.tsx");
assert.match(dialogSource, /workspace-content-light[^\n]*bg-\[var\(--surface-panel-elevated\)\]/);

const toastSource = read("src/features/pap/components/pap-toasts.tsx");
assert.match(
  toastSource,
  /workspace-content-light/,
  "shared workspace toasts must establish the current light-theme token scope",
);
assert.match(
  toastSource,
  /text-\[var\(--text-primary\)\]/,
  "shared workspace toast messages must use the semantic foreground token",
);

const teamsSource = read("src/components/teams-page-client.tsx");
assert.doesNotMatch(
  teamsSource,
  /var\(--color-(?:brand-ink|text-secondary)\)/,
  "teams must use the scoped semantic light-theme tokens",
);

const formatterSource = read("src/components/service-builder-client.tsx");
const formatterUploadSource = formatterSource.slice(
  formatterSource.indexOf('activeSongStep === "upload"'),
  formatterSource.indexOf('activeSongStep === "format"'),
);
assert.doesNotMatch(
  formatterUploadSource,
  /var\(--color-(?:brand-border|brand-ink|brand-panel|brand-panel-strong|focus|secondary|text-secondary)\)/,
  "song formatter upload must use the scoped semantic light-theme tokens",
);
assert.match(formatterSource, /router\.push\("\/song-formatter\/format"\)/);
assert.doesNotMatch(formatterSource, /(?:href=|router\.push\()"\/songs\/(?:upload|format)"/);

const workspaceShellSource = read("src/components/workspace-shell.tsx");
const warningMap = workspaceShellSource.slice(
  workspaceShellSource.indexOf("const IN_PROGRESS_WARNINGS"),
  workspaceShellSource.indexOf("type InProgressWarningKey"),
);
assert.doesNotMatch(warningMap, /"\/dashboard"/);

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { canViewDesignSystem, DESIGN_SYSTEM_VIEWER_EMAIL } from "./design-system-access.ts";

export function runDesignSystemGalleryTests() {
  const routePath = join(process.cwd(), "src", "app", "w", "[workspaceSlug]", "[[...path]]", "page.tsx");
  const galleryPath = join(process.cwd(), "src", "components", "design-system-gallery-client.tsx");
  const shellPath = join(process.cwd(), "src", "components", "workspace-shell.tsx");
  const routeSource = readFileSync(routePath, "utf8");
  const shellSource = readFileSync(shellPath, "utf8");

  assert.equal(DESIGN_SYSTEM_VIEWER_EMAIL, "yuartsijan@gmail.com");
  assert.equal(canViewDesignSystem("yuartsijan@gmail.com"), true);
  assert.equal(canViewDesignSystem("  YUARTSIJAN@gmail.com "), true);
  assert.equal(canViewDesignSystem("another.user@gmail.com"), false);
  assert.equal(canViewDesignSystem(null), false);

  assert.equal(existsSync(galleryPath), true);
  const gallerySource = existsSync(galleryPath) ? readFileSync(galleryPath, "utf8") : "";

  assert.match(routeSource, /case "design-system":/);
  assert.match(routeSource, /await requireAuthenticatedUser\(\)/);
  assert.match(routeSource, /!canViewDesignSystem\(user\.email\)/);
  assert.match(routeSource, /notFound\(\)/);
  assert.match(routeSource, /<DesignSystemGalleryClient \/>/);

  assert.match(shellSource, /canViewDesignSystem\(accountEmail\)/);
  assert.match(shellSource, /toWorkspacePath\("\/design-system"\)/);

  for (const contract of [
    "Token palette",
    "Typography",
    "Buttons",
    "Form controls",
    "Operational table",
    "Modals",
    "Toasts",
  ]) {
    assert.match(gallerySource, new RegExp(contract));
  }
  assert.match(gallerySource, /ui-btn-primary/);
  assert.match(gallerySource, /ui-btn-cancel/);
  assert.match(
    gallerySource,
    /className="ui-btn-primary[^\"]*"><Save[^>]*\/>Save changes<\/button>/,
  );
  assert.match(gallerySource, /ui-field/);
  assert.match(gallerySource, /ui-ledger-header/);
  assert.match(gallerySource, /ui-ledger-row/);
  assert.match(gallerySource, /PAPToastViewport/);
  assert.match(gallerySource, /DialogContent/);
  assert.match(gallerySource, /ProductionSelect/);
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function runPAPLightThemeTests() {
  const desktopClient = readFileSync(
    join(process.cwd(), "src", "features", "pap", "components", "pap-desktop-client.tsx"),
    "utf8",
  );
  const uploadPanel = readFileSync(
    join(process.cwd(), "src", "features", "pap", "components", "pap-upload-panel.tsx"),
    "utf8",
  );

  assert.ok(
    desktopClient.includes(
      '<div className={`${embedded ? "space-y-5" : "space-y-6"} text-[var(--text-primary)]`}>',
    ),
  );
  assert.match(desktopClient, /ui-btn-secondary/);
  assert.match(
    desktopClient,
    /DropdownMenuContent[\s\S]*?className="workspace-content-light[^"]*text-\[var\(--text-primary\)\]/,
  );
  assert.doesNotMatch(
    desktopClient,
    /DropdownMenuItem[\s\S]*?variant="destructive"/,
  );
  assert.match(
    desktopClient,
    /DialogContent className="workspace-content-light[^"]*bg-\[var\(--surface-panel\)\]/,
  );
  assert.match(uploadPanel, /className="ui-surface-panel text-\[var\(--text-primary\)\]"/);
}

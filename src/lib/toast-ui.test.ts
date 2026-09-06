import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function runToastUiTests() {
  const toasts = readFileSync(join(process.cwd(), "src", "features", "pap", "components", "pap-toasts.tsx"), "utf8");
  const shell = readFileSync(join(process.cwd(), "src", "components", "workspace-shell.tsx"), "utf8");

  assert.match(toasts, /tone: "info" \| "success" \| "error"/);
  assert.match(toasts, /role=\{toast\.tone === "error" \? "alert" : "status"\}/);
  assert.match(toasts, /aria-live=\{toast\.tone === "error" \? "assertive" : "polite"\}/);
  assert.match(toasts, /--state-danger-soft/);
  assert.match(toasts, /options\.durationMs === undefined/);
  assert.match(shell, /PAPToastViewport/);
  assert.match(shell, /usePAPToasts/);
  assert.doesNotMatch(shell, /type ReportToast/);
  assert.doesNotMatch(shell, /setReportToast/);
}

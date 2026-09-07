import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function runDashboardTests() {
  const dashboard = readFileSync(join(process.cwd(), "src", "components", "worship-service-planner-client.tsx"), "utf8");
  const renderedDashboard = dashboard.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  assert.doesNotMatch(renderedDashboard, /CURRENT SERVICE/);
  assert.doesNotMatch(renderedDashboard, /Create service/);
  assert.doesNotMatch(renderedDashboard, /SERVICE FLOW/);
  assert.doesNotMatch(renderedDashboard, /<article/);
  assert.match(renderedDashboard, /completedChecklistItemIds/);
  assert.match(renderedDashboard, /toggleChecklistItem/);
  assert.match(renderedDashboard, /line-through/);
  assert.match(renderedDashboard, /aria-pressed=\{isCompleted\}/);
}

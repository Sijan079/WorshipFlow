import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function runDashboardTests() {
  const dashboard = readFileSync(join(process.cwd(), "src", "components", "worship-service-planner-client.tsx"), "utf8");

  assert.match(dashboard, /selectServiceForUpcomingSunday/);
  assert.match(dashboard, /CURRENT SERVICE/);
  assert.match(dashboard, /Create service/);
  assert.doesNotMatch(dashboard, /BOOTH TOOLS/);
  assert.doesNotMatch(dashboard, /SERVICE FLOW/);
  assert.match(dashboard, /PRE-SERVICE CHECKLIST[\s\S]*CURRENT SERVICE/);
  assert.doesNotMatch(dashboard, /xl:grid-cols-\[minmax\(0,1\.45fr\)_minmax\(22rem,0\.9fr\)\]/);
  assert.match(dashboard, /<section className="max-w-6xl py-1">/);
  assert.doesNotMatch(dashboard, /<article/);
  assert.match(dashboard, /sm:grid-cols-\[2rem_minmax\(9rem,0\.65fr\)_minmax\(0,1\.85fr\)\]/);
  assert.match(dashboard, /currentService\?\.blocks \?\? \[\]/);
  assert.match(dashboard, /getServiceBlockDisplayValues/);
  assert.match(dashboard, /completedChecklistItemIds/);
  assert.match(dashboard, /toggleChecklistItem/);
  assert.match(dashboard, /line-through/);
  assert.match(dashboard, /aria-pressed=\{isCompleted\}/);
  assert.doesNotMatch(dashboard, /dashboard-header ui-stage-enter border-b/);
}

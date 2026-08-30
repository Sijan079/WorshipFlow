import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function runServiceTemplateRenderingTests() {
  const route = readFileSync(join(process.cwd(), "src", "app", "api", "services", "route.ts"), "utf8");
  const page = readFileSync(join(process.cwd(), "src", "components", "services-page-client.tsx"), "utf8");
  const readOnlyDetails = page.slice(page.indexOf("function ReadOnlyServiceDetails"), page.indexOf("type ServiceListItem"));

  assert.match(route, /blocks:\s*\{[\s\S]*?orderBy:\s*\{\s*order:\s*"asc"/);
  assert.match(page, /Service flow/);
  assert.match(page, /function ServiceBlockEditor/);
  assert.match(page, /TeamMemberPicker/);
  assert.equal((page.match(/<TeamMemberPicker/g) ?? []).length, 2);
  assert.match(page, /blocks=\{service\.blocks\}/);
  assert.match(page, /services-register ui-surface-elevated/);
  assert.match(page, /lg:flex-row lg:items-end lg:justify-between/);
  assert.match(page, /grid-cols-\[2rem_minmax\(10rem,0\.8fr\)_minmax\(12rem,1\.2fr\)\]/);
  assert.match(page, /service\.blocks\.map\(\(block, index\)/);
  assert.match(page, /String\(index \+ 1\)\.padStart\(2, "0"\)/);
  assert.match(page, /border-l-4 border-\[var\(--action-primary-bg\)\]/);
  assert.doesNotMatch(page, /<span>Sermon verse<\/span>/);
  assert.doesNotMatch(page, /service\.sermonVerse \|\| "No sermon verse"/);
  assert.match(page, /const \[editServiceDate, setEditServiceDate\] = useState\(""\);/);
  assert.match(page, /serviceDate: new Date\(serviceDate\)\.toISOString\(\)/);
  assert.match(page, /const service = await apiFetch<ServiceRecord>\(/);
  assert.match(page, /aria-label="Service date"/);
  assert.match(page, /status: ServiceStatus\.READY/);
  assert.match(page, /Mark ready/);
  assert.doesNotMatch(readOnlyDetails, /<dl/);
  assert.match(readOnlyDetails, /text-right/);
  assert.match(readOnlyDetails, /formatServantDisplayName/);
  assert.doesNotMatch(readOnlyDetails, /text-\[var\(--text-accent\)\]/);
  assert.doesNotMatch(page, /<ServiceFormFields/);
  assert.doesNotMatch(page, /<h4[^>]*>Bible verses<\/h4>/);
  assert.doesNotMatch(page, /<h3>Servants<\/h3>/);
  assert.doesNotMatch(page, /<h3>Hymnals<\/h3>/);
}

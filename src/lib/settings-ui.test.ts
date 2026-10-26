import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/components/settings-page-client.tsx"), "utf8");
const adminSource = readFileSync(join(process.cwd(), "src/components/settings-admin-sections.tsx"), "utf8");
const workspaceSection = adminSource.slice(adminSource.indexOf("export function WorkspaceSection"), adminSource.indexOf("type MemberRecord"));
const dialogSource = readFileSync(join(process.cwd(), "src/components/ui/dialog.tsx"), "utf8");
const globalStyles = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

assert.match(workspaceSection, /return <section className="space-y-3">/);
assert.match(workspaceSection, /Workspace identity<\/h3>[\s\S]*?Set the name and visual identity your team sees across the workspace\.<\/p>[\s\S]*?overflow-hidden rounded-lg border/);
assert.match(source, /data-settings-section-stack className="space-y-8"/);
assert.match(dialogSource, /workspace-content-light fixed left-1\/2 top-1\/2/);
assert.match(globalStyles, /html body\[data-scroll-locked\]\s*\{[\s\S]*?position:\s*static\s*!important;/);
assert.match(globalStyles, /html body\[data-scroll-locked\]\s*\{[\s\S]*?margin-right:\s*0\s*!important;/);

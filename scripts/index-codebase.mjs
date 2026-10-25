import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "docs/codebase-map");
const registryPath = path.join(outputDir, "symbols.json");
const modules = [
  {
    id: "routing-access", title: "Routing and access",
    responsibility: "Workspace page dispatch, Supabase sessions, route-level membership checks, and API scoping.",
    entry: ["src/proxy.ts", "src/app/w/[workspaceSlug]/[[...path]]/page.tsx", "src/lib/security-context.ts"],
    important: ["proxy", "WorkspacePathPage", "getActiveWorkspaceId", "requireAuthenticatedUser"],
    relationships: "Proxy passes workspace context to route handlers; handlers resolve active membership before Prisma reads or writes.",
    effects: "Session refresh, redirects, authorization failures, and database-backed membership reads.",
  },
  {
    id: "service-flow", title: "Service flow",
    responsibility: "Service creation, stored template block snapshots, ordered rendering, assignments, and service mutations.",
    entry: ["src/app/api/services/route.ts", "src/app/api/services/[id]/route.ts", "src/components/services-page-client.tsx"],
    important: ["GET", "POST", "serviceDetailInclude", "normalizeServiceBlockInputs", "getServiceBlockOrder"],
    relationships: "Service routes use shared validation and Prisma; UI consumes ordered service payloads. Template blocks are copied at creation.",
    effects: "Service, block, participant, song, and detail records are persisted. Stored block order is the display order.",
  },
  {
    id: "settings-teams", title: "Settings and teams",
    responsibility: "Workspace templates, presets, checklists, integrations, membership, invitations, and servant roster.",
    entry: ["src/components/settings-page-client.tsx", "src/components/teams-page-client.tsx", "src/app/api/settings/service-templates/route.ts"],
    important: ["SettingsPageClient", "TeamsPageClient", "GET", "POST"],
    relationships: "Settings clients call scoped settings APIs; service creation reads saved template blocks and team assignments.",
    effects: "Workspace configuration, membership, and servant records change; integration secrets remain server-side.",
  },
  {
    id: "songs-formatter", title: "Songs and formatter",
    responsibility: "Song repository, lyrics extraction, editable song document, DOCX output, and temporary draft recovery.",
    entry: ["src/app/api/songs/route.ts", "src/features/song-formatter/song-document-editor.tsx", "src/app/api/song-formatter/draft/route.ts"],
    important: ["SongDocumentEditor", "GET", "POST", "useServerDraft", "useDraftRecovery"],
    relationships: "Formatter hooks and editor share document helpers; extraction and draft routes provide server-backed conversion and recovery.",
    effects: "Song and draft records may be written; extraction may call an optional AI provider; DOCX downloads are produced.",
  },
  {
    id: "media-tools", title: "Media tools",
    responsibility: "Phone transfer, QR, image resize, background creation/removal, and comment-card preparation.",
    entry: ["src/components/service-builder-client.tsx", "src/features/pap/server/pap-inbox.ts", "src/app/api/media/backgrounds/generate/route.ts"],
    important: ["ServiceBuilderClient", "QRGeneratorTool", "ResizeImageTool", "BackgroundGeneratorTool", "CommentCardTool"],
    relationships: "Tool UI calls PAP and media routes; media routes use provider, rate-limit, and private storage helpers.",
    effects: "Temporary uploads and generated files are stored or downloaded; AI background operations can call a configured provider.",
  },
  {
    id: "automation-outputs", title: "Automation and outputs",
    responsibility: "Service job requests, status/history, generated-output records, and private downloads.",
    entry: ["src/app/api/services/[id]/jobs/route.ts", "src/app/api/services/[id]/outputs/[outputId]/download/route.ts", "src/lib/private-output-storage.ts"],
    important: ["GET", "POST", "downloadPrivateOutput"],
    relationships: "Service job routes persist Prisma jobs and outputs; download routes resolve workspace access and private storage.",
    effects: "Job/output rows and private files are created or read. Inspect the route before assuming a job type has a production worker.",
  },
  {
    id: "ui-shell", title: "UI shell",
    responsibility: "Workspace layout, navigation, shared controls, provider setup, and design tokens.",
    entry: ["src/components/workspace-shell.tsx", "src/app/w/[workspaceSlug]/layout.tsx", "src/components/Providers.tsx"],
    important: ["WorkspaceShell", "Providers", "WorkspaceLayout"],
    relationships: "Workspace layout wraps page dispatch; shared UI components and token styles shape feature screens.",
    effects: "Client navigation, query cache setup, and visual state; no domain persistence is owned here.",
  },
  {
    id: "data-operations", title: "Data and operations",
    responsibility: "Prisma contract, database connection, provisioning, environment checks, instrumentation, and developer scripts.",
    entry: ["prisma/schema.prisma", "src/lib/prisma.ts", "scripts/dev-hosted.mjs", "src/instrumentation.ts"],
    important: ["prisma", "register", "onRequestError"],
    relationships: "Feature routes use the shared Prisma client; startup scripts validate environment targets before Next starts.",
    effects: "Database connections, workspace provisioning, migration operations, and telemetry export.",
  },
];
const moduleById = new Map(modules.map((module) => [module.id, module]));

function relative(file) { return path.relative(root, file).replaceAll("\\", "/"); }
function hash(content) { return createHash("sha256").update(content).digest("hex"); }
function writeIfChanged(file, content, check = false) {
  if (existsSync(file) && readFileSync(file, "utf8") === content) return false;
  if (!check) writeFileSync(file, content);
  return true;
}
function collect(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    if (["node_modules", ".next", "dist", "build", "generated", "coverage", "fixtures"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, files);
    else if (/\.(?:ts|tsx|mjs)$/.test(entry.name) && !/(?:\.test|\.spec|\.d)\.(?:ts|tsx|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}
function moduleFor(file) {
  if (file.startsWith("prisma/") || file.startsWith("scripts/") || file === "src/instrumentation.ts" || file === "src/lib/prisma.ts") return "data-operations";
  if (file.startsWith("src/features/pap/") || file.startsWith("src/features/media-generation/") || file.startsWith("src/app/api/media/") || file.startsWith("src/app/api/pap/") || /src\/components\/(?:qr-generator|resize-image|background-|comment-card)/.test(file)) return "media-tools";
  if (file.startsWith("src/features/song-formatter/") || file.startsWith("src/app/api/songs/") || file.startsWith("src/app/api/song-") || file.startsWith("src/app/api/extractor/") || file.startsWith("src/app/api/song-tags/") || /src\/lib\/(?:extractor|lyrics-docx|transpose)/.test(file)) return "songs-formatter";
  if (file.startsWith("src/app/api/services/") && /\/(?:jobs|outputs|automation-batches)\//.test(file)) return "automation-outputs";
  if (file.startsWith("src/app/api/services/") || /src\/lib\/(?:service-|template-|program-block|validation)/.test(file) || /src\/components\/(?:services-page|worship-service-planner)/.test(file)) return "service-flow";
  if (file.startsWith("src/app/api/settings/") || file.startsWith("src/app/api/members/") || file.startsWith("src/app/api/servants/") || /src\/components\/(?:settings-|teams-page)/.test(file) || /src\/lib\/(?:settings-|servants|team-member|workspace-integrations)/.test(file)) return "settings-teams";
  if (file === "src/proxy.ts" || file.startsWith("src/app/w/") && file.endsWith("page.tsx") || file.startsWith("src/app/api/auth/") || file.startsWith("src/app/auth/") || file.startsWith("src/lib/supabase/") || /src\/lib\/(?:security-|workspace-auth|workspace-context|access-auth|auth-redirect|proxy-paths)/.test(file)) return "routing-access";
  if (file.startsWith("src/components/") || file.startsWith("src/app/(workspace)/") || file.startsWith("src/app/w/") || file.startsWith("src/app/login/") || file.startsWith("src/app/workspaces/") || file.startsWith("src/app/page") || file.startsWith("src/app/layout")) return "ui-shell";
  if (file.startsWith("src/lib/private-output-storage") || file.startsWith("src/lib/temporary-automation")) return "automation-outputs";
  return "data-operations";
}
function parseFile(file, source, digest) {
  const name = relative(file);
  const kind = name.endsWith(".tsx") ? ts.ScriptKind.TSX : name.endsWith(".mjs") ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, kind);
  const imports = [];
  const bindings = new Map();
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const from = statement.moduleSpecifier.text;
    imports.push(from);
    const clause = statement.importClause;
    if (clause?.name) bindings.set(clause.name.text, from);
    if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) bindings.set(clause.namedBindings.name.text, from);
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const item of clause.namedBindings.elements) bindings.set(item.name.text, from);
  }
  const symbols = [];
  function add(name, symbolKind, node, signatureNode = node) {
    const loc = ast.getLineAndCharacterOfPosition(node.getStart(ast));
    const used = new Set();
    function visit(child) { if (ts.isIdentifier(child) && bindings.has(child.text)) used.add(bindings.get(child.text)); ts.forEachChild(child, visit); }
    visit(node);
    let signature = signatureNode.getText(ast).split("\n").map((part) => part.trim()).join(" ");
    if (node.body && node.body.pos > signatureNode.pos) signature = source.slice(signatureNode.getStart(ast), node.body.getStart(ast)).replace(/\s+/g, " ").trim();
    if (signature.length > 240) signature = `${signature.slice(0, 237)}...`;
    symbols.push({ name, kind: symbolKind, line: loc.line + 1, column: loc.character + 1, signature, dependencies: [...used].sort() });
  }
  for (const node of ast.statements) {
    const exported = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (ts.isExportDeclaration(node)) {
      const from = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : undefined;
      if (node.exportClause && ts.isNamedExports(node.exportClause)) for (const item of node.exportClause.elements) add(item.name.text, "re-export", item, item);
      else if (from) add("*", "re-export", node, node);
      if (from) imports.push(from);
    } else if (ts.isExportAssignment(node)) add("default", "default", node, node.expression);
    else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || exported && (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node))) {
      add(node.name?.text ?? "default", ts.SyntaxKind[node.kind].replace("Declaration", ""), node);
      if (ts.isClassDeclaration(node)) for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && member.name) add(`${node.name?.text ?? "default"}.${member.name.getText(ast)}`, "method", member);
      }
    } else if (exported && ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) if (ts.isIdentifier(declaration.name)) add(declaration.name.text, "variable", declaration);
    } else if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) add(declaration.name.text, "function variable", declaration);
      }
    }
  }
  return { path: name, module: moduleFor(name), sha256: digest, imports: [...new Set(imports)].sort(), symbols };
}
function link(file, label = file, line) { return `[${label}](../../${file.replaceAll("[", "%5B").replaceAll("]", "%5D").replaceAll("(", "%28").replaceAll(")", "%29")}${line ? `#L${line}` : ""})`; }
function renderModule(module, files) {
  const own = files.filter((file) => file.module === module.id);
  const important = module.important.flatMap((name) => {
    const ordered = [...own].sort((a, b) => {
      const aRank = module.entry.indexOf(a.path), bRank = module.entry.indexOf(b.path);
      return (aRank < 0 ? 999 : aRank) - (bRank < 0 ? 999 : bRank) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    });
    return ordered.flatMap((file) => file.symbols.filter((symbol) => symbol.name === name).map((symbol) => ({ file, symbol }))).slice(0, name === "GET" || name === "POST" ? 1 : 2);
  }).slice(0, 12);
  const imported = new Map();
  for (const file of own) for (const specifier of file.imports) if (specifier.startsWith("@/")) {
    const target = `src/${specifier.slice(2)}`;
    const targetModule = moduleFor(target);
    if (targetModule !== module.id) imported.set(targetModule, (imported.get(targetModule) ?? 0) + 1);
  }
  const related = [...imported].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4);
  return `# ${module.title}\n\n${module.responsibility}\n\n## Entry points\n\n${module.entry.map((file) => `- ${link(file)}`).join("\n")}\n\n## Important exports\n\n${important.length ? important.map(({ file, symbol }) => `- \`${symbol.name}\` — ${link(file.path, `${file.path}:${symbol.line}`, symbol.line)}`).join("\n") : "- Use \`npm run codemap -- find <name>\` for symbol locations."}\n\n## Relationships\n\n${module.relationships}\n\n${related.length ? `Frequent cross-module imports: ${related.map(([id]) => `[${moduleById.get(id).title}](./${id}.md)`).join(", ")}.\n\n` : ""}## Side effects\n\n${module.effects}\n\nUse \`npm run codemap -- find <name>\`, \`refs <name>\`, or \`deps <name-or-path>\` for bounded JSON. Verify source before editing.\n`;
}

export function updateCodebaseIndex({ check = false } = {}) {
  mkdirSync(outputDir, { recursive: true });
  const previous = existsSync(registryPath) ? JSON.parse(readFileSync(registryPath, "utf8")) : { files: [] };
  const cache = new Map((previous.version === 2 ? previous.files : []).map((file) => [file.path, file]));
  const paths = [...collect(path.join(root, "src")), ...collect(path.join(root, "scripts")), ...collect(path.join(root, "prisma"))].sort((a, b) => relative(a) < relative(b) ? -1 : relative(a) > relative(b) ? 1 : 0);
  let parsed = 0;
  const files = paths.map((file) => {
    const source = readFileSync(file, "utf8");
    const digest = hash(source);
    const old = cache.get(relative(file));
    if (old?.sha256 === digest && old.module === moduleFor(relative(file))) return old;
    parsed++;
    return parseFile(file, source, digest);
  });
  const registry = `${JSON.stringify({ version: 2, files }, null, 2)}\n`;
  const index = `# Codebase Knowledge Map\n\nStart here for code navigation. These maps are generated from source and curated module metadata; verify the linked source before a change. [Product and document map](../map.md).\n\n| Module | Responsibility | Map |\n| --- | --- | --- |\n${modules.map((module) => `| ${module.title} | ${module.responsibility} | [Open](./${module.id}.md) |`).join("\n")}\n\n[Architecture diagram](./architecture.mmd) · [Symbol registry](./symbols.json) (query it through the CLI; do not load it all).\n\n## Focused search\n\n\`npm run codemap -- find <symbol>\` returns matching declarations. \`refs <symbol>\` finds identifier uses in the defining file and direct importers. \`deps <symbol-or-path>\` shows indexed imports. Results are JSON, capped at 10 rows, with \`total\` indicating additional matches. References are a source-based navigation hint, not a type-checked call graph; verify source before edits.\n\nRefresh with \`npm run codemap -- update\` (or \`npm run index:codebase\`). Use \`npm run index:codebase -- --check\` to detect stale output. The script parses only changed source files using SHA-256 values cached in \`symbols.json\`; unchanged outputs are not rewritten. Tests, declarations, fixtures, generated folders, dependencies, and build output are excluded.\n`;
  const diagram = `flowchart LR\n  Browser[Browser] --> Proxy[Next Proxy and Supabase session]\n  Proxy --> Pages[Workspace pages and UI]\n  Pages --> API[Workspace-scoped route handlers]\n  API --> Access[Membership and role checks]\n  Access --> Prisma[Prisma]\n  Prisma --> DB[(PostgreSQL)]\n  API --> Storage[Private output storage]\n  API --> Provider[Optional AI provider]\n  Pages --> Local[Browser-local media tools]\n`;
  const outputs = [[registryPath, registry], [path.join(outputDir, "INDEX.md"), index], [path.join(outputDir, "architecture.mmd"), diagram], ...modules.map((module) => [path.join(outputDir, `${module.id}.md`), renderModule(module, files)])];
  const changed = outputs.filter(([file, content]) => writeIfChanged(file, content, check)).map(([file]) => relative(file));
  return { files: files.length, parsed, reused: files.length - parsed, changed };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const check = process.argv.includes("--check");
  const result = updateCodebaseIndex({ check });
  if (check && result.changed.length) { console.error(`Codebase map is stale: ${result.changed.join(", ")}`); process.exitCode = 1; }
  else console.log(`${check ? "Checked" : "Indexed"} ${result.files} files (${result.parsed} parsed, ${result.reused} reused); ${result.changed.length} output files ${check ? "stale" : "updated"}.`);
}

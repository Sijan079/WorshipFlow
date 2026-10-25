import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const LIMIT = 10;

function pack(command, query, matches) {
  return { command, query, total: matches.length, results: matches.slice(0, LIMIT) };
}

function rank(value, query) {
  const name = value.toLowerCase(), needle = query.toLowerCase();
  if (name === needle) return 0;
  if (name.startsWith(needle)) return 1;
  if (name.includes(needle)) return 2;
  return 3;
}

export function findSymbols(registry, query) {
  const matches = registry.files.flatMap((file) => file.symbols
    .filter((symbol) => symbol.name.toLowerCase().includes(query.toLowerCase()))
    .map((symbol) => ({ name: symbol.name, file: file.path, line: symbol.line, column: symbol.column, kind: symbol.kind, signature: symbol.signature, dependencies: symbol.dependencies.slice(0, 8) })));
  matches.sort((a, b) => rank(a.name, query) - rank(b.name, query) || a.name.localeCompare(b.name) || a.file.localeCompare(b.file) || a.line - b.line);
  return pack("find", query, matches);
}

function resolvedImport(fromFile, specifier, fileSet) {
  let target;
  if (specifier.startsWith("@/")) target = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith(".")) target = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  else return null;
  for (const candidate of [target, `${target}.ts`, `${target}.tsx`, `${target}.mjs`, `${target}/index.ts`, `${target}/index.tsx`]) if (fileSet.has(candidate)) return candidate;
  return null;
}

export function findReferences(registry, query, root) {
  const definitions = registry.files.flatMap((file) => file.symbols.filter((symbol) => symbol.name === query && symbol.kind !== "re-export").map((symbol) => ({ file: file.path, symbol })));
  const sourceFiles = new Set(definitions.map(({ file }) => file));
  const fileSet = new Set(registry.files.map((file) => file.path));
  const matches = [];
  for (const file of registry.files) {
    const sameFile = sourceFiles.has(file.path);
    if (!sameFile && !file.imports.some((specifier) => sourceFiles.has(resolvedImport(file.path, specifier, fileSet)))) continue;
    const source = readFileSync(path.join(root, file.path), "utf8");
    const ast = ts.createSourceFile(file.path, source, ts.ScriptTarget.Latest, true, file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : file.path.endsWith(".mjs") ? ts.ScriptKind.JS : ts.ScriptKind.TS);
    const names = new Set(sameFile ? [query] : []);
    const namespaces = new Set();
    for (const statement of ast.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      if (!sourceFiles.has(resolvedImport(file.path, statement.moduleSpecifier.text, fileSet))) continue;
      const clause = statement.importClause;
      if (clause?.name && query === "default") names.add(clause.name.text);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const item of clause.namedBindings.elements) if ((item.propertyName?.text ?? item.name.text) === query) names.add(item.name.text);
      }
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) namespaces.add(clause.namedBindings.name.text);
    }
    if (!names.size && !namespaces.size) continue;
    function visit(node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
      if (ts.isIdentifier(node) && names.has(node.text) && node.parent?.name !== node) {
        const property = ts.isPropertyAccessExpression(node.parent) && node.parent.name === node;
        if (!property) {
          const loc = ast.getLineAndCharacterOfPosition(node.getStart(ast));
          matches.push({ name: query, file: file.path, line: loc.line + 1, column: loc.character + 1, dependencies: [...sourceFiles].sort() });
        }
      } else if (ts.isPropertyAccessExpression(node) && namespaces.has(node.expression.getText(ast)) && node.name.text === query) {
        const loc = ast.getLineAndCharacterOfPosition(node.name.getStart(ast));
        matches.push({ name: query, file: file.path, line: loc.line + 1, column: loc.character + 1, dependencies: [...sourceFiles].sort() });
      }
      ts.forEachChild(node, visit);
    }
    for (const statement of ast.statements) visit(statement);
  }
  matches.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);
  return pack("refs", query, matches);
}

export function findDependencies(registry, query) {
  const needle = query.toLowerCase();
  const matches = registry.files.flatMap((file) => {
    const fileMatch = file.path.toLowerCase().includes(needle) || file.module.toLowerCase().includes(needle);
    if (fileMatch) return [{ name: path.posix.basename(file.path), file: file.path, line: 1, dependencies: file.imports.slice(0, 12) }];
    return file.symbols.filter((symbol) => symbol.name.toLowerCase().includes(needle)).map((symbol) => ({ name: symbol.name, file: file.path, line: symbol.line, dependencies: symbol.dependencies.slice(0, 12) }));
  });
  matches.sort((a, b) => rank(a.name, query) - rank(b.name, query) || rank(a.file, query) - rank(b.file, query) || a.file.localeCompare(b.file) || a.line - b.line);
  return pack("deps", query, matches);
}

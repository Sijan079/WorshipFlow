// Local-only fixture with real Prisma transactions and real recovery hook.
// Only disposable test identities are reachable; this is NOT an app auth bypass.
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import prisma from "../src/lib/prisma.ts";
import { createFormatterDraft, changeFormatterDraft, getFormatterDraft } from "../src/features/song-formatter/draft-store.ts";
import { DraftRequestSchema } from "../src/features/song-formatter/draft-contract.ts";

if (!["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error("Local database only");
const suffix = randomUUID();
const user = await prisma.user.create({ data: { authProviderId: `fixture-${suffix}`, email: `${suffix}@example.invalid` } });
const scopes = {};
for (const name of ["fixture", "other"]) {
  const workspace = await prisma.workspace.create({ data: { slug: `fixture-${name}-${suffix}`, name: "Disposable formatter fixture" } });
  scopes[name] = { workspaceId: workspace.id, userId: user.id };
  await prisma.workspaceMembership.create({ data: { ...scopes[name], role: "OWNER", status: "ACTIVE" } });
}
await createFormatterDraft(scopes.fixture, { content: { text: "[Verse]\nFirst line\nSecond line\n\n[Chorus]\nSing together", songTitle: "Way Maker", warningCodes: [], warningsDismissed: false, directAiReformatUsed: false }, sourceName: "Way Maker.docx", parser: "docx" });
const output = await mkdtemp(join(tmpdir(), "worship-server-draft-"));
await build({ entryPoints: ["scripts/fixtures/server-draft.tsx"], bundle: true, outfile: `${output}/editor.js`, jsx: "automatic", define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" } });
const css = await postcss([tailwind()]).process(await readFile("src/app/globals.css", "utf8"), { from: resolve("src/app/globals.css") });
await writeFile(`${output}/global.css`, css.css);
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:4319");
  try {
    if (url.pathname === "/api/auth/session") {
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ authenticated: true, user: { id: user.authProviderId, role: "OWNER" } }));
    } else if (url.pathname.match(/^\/api\/workspaces\/(fixture|other)\/song-formatter\/draft$/)) {
      const scope = scopes[url.pathname.split("/")[3]];
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const result = req.method === "POST" ? await changeFormatterDraft(scope, DraftRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString()))) : await getFormatterDraft(scope);
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(result));
    } else if (["/editor.js", "/editor.css", "/global.css"].includes(url.pathname)) {
      res.setHeader("Content-Type", url.pathname.endsWith(".css") ? "text/css" : "text/javascript"); res.end(await readFile(`${output}${url.pathname}`));
    } else {
      res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/editor.css"><title>Temporary draft fixture</title></head><body><div id="root"></div><script src="/editor.js"></script></body></html>');
    }
  } catch (error) { res.writeHead(error.status ?? 500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: error.message })); }
});
async function stop() {
  server.close();
  for (const scope of Object.values(scopes)) await prisma.workspace.delete({ where: { id: scope.workspaceId } });
  await prisma.user.delete({ where: { id: user.id } }); await prisma.$disconnect(); process.exit();
}
process.on("SIGINT", stop); process.on("SIGTERM", stop);
server.listen(4319, "127.0.0.1", () => {
  console.log("Temporary draft fixture: http://127.0.0.1:4319");
  console.log("Disposable fixture IDs:", JSON.stringify({ userId: user.id, workspaces: Object.values(scopes).map(scope => scope.workspaceId) }));
});

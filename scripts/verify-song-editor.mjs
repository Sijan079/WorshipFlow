// An isolated browser fixture: real editor/recovery code, no app auth bypass.
// Generated bundles live in a temporary directory; this is not a Next dev server.
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { createLyricsDocx } from "../src/lib/lyrics-docx.ts";

const output = await mkdtemp(join(tmpdir(), "worship-song-editor-"));
await build({ entryPoints: ["scripts/fixtures/song-editor.tsx"], bundle: true, outfile: `${output}/editor.js`, jsx: "automatic", sourcemap: true, define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" } });
const css = await postcss([tailwind()]).process(await readFile("src/app/globals.css", "utf8"), { from: resolve("src/app/globals.css") });
await writeFile(`${output}/global.css`, css.css);

createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:4318");
  if (url.pathname === "/api/auth/session") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ authenticated: true, user: { id: "fixture-user", role: "OWNER" } }));
  } else if (url.pathname === "/export" && req.method === "POST") {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const { text } = JSON.parse(Buffer.concat(chunks).toString());
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.end(Buffer.from(await createLyricsDocx(text)));
    } catch { res.writeHead(400); res.end(); }
  } else if (["/editor.js", "/editor.css", "/global.css"].includes(url.pathname)) {
    res.setHeader("Content-Type", url.pathname.endsWith(".css") ? "text/css" : "text/javascript");
    res.end(await readFile(`${output}${url.pathname}`));
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/editor.css"><title>Song editor verification fixture</title></head><body><div id="root"></div><script src="/editor.js"></script></body></html>');
  }
}).listen(4318, "127.0.0.1", () => console.log("Song editor fixture: http://127.0.0.1:4318"));

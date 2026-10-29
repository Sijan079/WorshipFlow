import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const read = (...segments: string[]) => readFileSync(join(process.cwd(), ...segments), "utf8");

function routeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === "route.ts" ? [path] : [];
  });
}

// The one place that sets its own caching on purpose: the public captions feed, which a congregation's phones
// poll every second and which carries caption text only (no people, ministry or attendance data).
const OWN_CACHING = ["captions/live/[token]/route.ts"];

test("every /api response says no-store, so nothing private depends on a framework default", () => {
  const config = read("next.config.ts");
  assert.match(config, /source: "\/api\/:path\(\(\?!captions\/live\/\)\.\*\)"/, "the rule covers /api except the public captions feed");
  const rule = config.slice(config.indexOf('source: "/api/:path'), config.indexOf('source: "/api/:path') + 400);
  assert.match(rule, /key: "Cache-Control"/);
  assert.match(rule, /value: "no-store"/);
});

test("only the public captions feed sets a cache header of its own", () => {
  const apiRoot = join(process.cwd(), "src", "app", "api");
  // A header is fine when its value is a string that says no-store ("no-store", "private, no-store", ...). Anything
  // else, such as a value worked out in code, is the route choosing its own caching.
  const choosesItsOwn = (text: string) => [...text.matchAll(/"Cache-Control":\s*("[^"]*"|[^,}\s]+)/g)].some((match) => !(match[1].startsWith('"') && match[1].includes("no-store")));
  const own = routeFiles(apiRoot)
    .filter((file) => choosesItsOwn(readFileSync(file, "utf8")))
    .map((file) => relative(apiRoot, file).replaceAll("\\", "/"));
  assert.deepEqual(own, OWN_CACHING, "a route that sets its own caching is a deliberate exception; add it here and to the rule in next.config.ts");
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ErrorNotificationDeleteQueue } from "./error-notification-delete-queue.ts";

function memoryStore() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

test("queued notification deletes survive a new queue instance and deduplicate", async () => {
  const store = memoryStore();
  const deleted: string[] = [];
  const first = new ErrorNotificationDeleteQueue(store, async (id) => { deleted.push(id); });
  first.enqueue("workspace:user", ["one", "two", "one"]);
  assert.deepEqual(first.getPending("workspace:user"), ["one", "two"]);

  const resumed = new ErrorNotificationDeleteQueue(store, async (id) => { deleted.push(id); });
  assert.deepEqual(resumed.getPending("workspace:user"), ["one", "two"]);
  assert.deepEqual(resumed.getPending("workspace:another-user"), []);
  assert.equal(await resumed.flush("workspace:user"), 2);
  assert.deepEqual(deleted, ["one", "two"]);
  assert.deepEqual(resumed.getPending("workspace:user"), []);
});

test("transient failures remain queued and an already deleted item is acknowledged", async () => {
  const store = memoryStore();
  let attempts = 0;
  const queue = new ErrorNotificationDeleteQueue(store, async (id) => {
    attempts += 1;
    if (id === "one" && attempts === 1) throw new Error("offline");
    if (id === "one") throw { status: 404 };
  });
  queue.enqueue("workspace:user", ["one", "two"]);
  assert.equal(await queue.flush("workspace:user"), 0);
  assert.deepEqual(queue.getPending("workspace:user"), ["one", "two"]);
  assert.equal(await queue.flush("workspace:user"), 2);
  assert.deepEqual(queue.getPending("workspace:user"), []);
});

test("the page queues only visible items and the shell excludes queued items from its badge", () => {
  const page = readFileSync(join(process.cwd(), "src/components/error-notifications-page.tsx"), "utf8");
  const shell = readFileSync(join(process.cwd(), "src/components/workspace-shell.tsx"), "utf8");
  assert.match(page, /queueDeletes\(notifications\.map\(\(item\) => item\.id\)\)/);
  assert.match(page, /filter\(\(item\) => !pendingSet\.has\(item\.id\)\)/);
  assert.match(shell, /filter\(\(item\) => !pendingNotificationDeletes\.has\(item\.id\)\)/);
});

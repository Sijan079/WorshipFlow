import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CaptionAssembler } from "./caption-contract.ts";
import { loadOperatorInput, saveOperatorInput } from "./operator-token-store.ts";
import { canResumeSession } from "./caption-resume.ts";
import { claimStreamLock, type LockManagerLike } from "./stream-lock.ts";

function read(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

// A tiny stand-in for navigator.locks: one holder per name, ifAvailable gives null while held.
function fakeLocks(): LockManagerLike {
  const held = new Set<string>();
  return {
    request(name, options, callback) {
      if (options.ifAvailable && held.has(name)) return Promise.resolve(callback(null));
      held.add(name);
      return Promise.resolve(callback({ name })).finally(() => held.delete(name));
    },
  };
}

// After a reload the booth reconnects to the same session and link; a duplicated tab must not also stream.
export async function runCaptionResumeTests() {
  // Only the browser that started the session, with its token and its remembered input, may resume it.
  assert.equal(canResumeSession({ allowed: true, token: "t", inputId: "mic" }), true);
  assert.equal(canResumeSession({ allowed: false, token: "t", inputId: "mic" }), false);
  assert.equal(canResumeSession({ allowed: true, token: "", inputId: "mic" }), false);
  assert.equal(canResumeSession({ allowed: true, token: "t", inputId: "" }), false);

  // The remembered input survives a reload of the same tab (sessionStorage), and is per session.
  const store = new Map<string, string>();
  (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  } as Storage;
  assert.deepEqual(loadOperatorInput("s1"), { id: "", label: "" });
  saveOperatorInput("s1", { id: "usb-mic", label: "USB Audio" });
  assert.deepEqual(loadOperatorInput("s1"), { id: "usb-mic", label: "USB Audio" });
  assert.deepEqual(loadOperatorInput("s2"), { id: "", label: "" });
  store.set("caption-input-s3", "{not json");
  assert.deepEqual(loadOperatorInput("s3"), { id: "", label: "" });

  // Duplicate Tab copies sessionStorage, so two tabs could both resume. Only one may hold the stream.
  const locks = fakeLocks();
  const first = await claimStreamLock("session-1", locks);
  assert.ok(first, "the first tab gets the stream");
  assert.equal(await claimStreamLock("session-1", locks), null, "a second tab does not");
  const other = await claimStreamLock("session-2", locks);
  assert.ok(other, "another session is a different lock");
  first!.release();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(await claimStreamLock("session-1", locks), "released, it can be taken again");
  // Where the Web Locks API is missing there is no guard, and nothing breaks.
  assert.ok(await claimStreamLock("session-1", undefined));

  // Line numbers continue after a reload. The server ignores a line that is already final, so a restart
  // at line 1 would silently drop every resumed caption.
  const assembler = new CaptionAssembler(5);
  const updates = assembler.accept({ is_final: true, speech_final: true, channel: { alternatives: [{ transcript: "Magandang umaga po" }] } });
  assert.equal(updates[0]?.line, 6);
  assert.equal(new CaptionAssembler().accept({ is_final: true, speech_final: true, channel: { alternatives: [{ transcript: "Hello" }] } })[0]?.line, 1);

  const sessions = read("src", "app", "api", "caption-sessions", "route.ts");
  assert.match(sessions, /captionLine\.aggregate/);
  assert.match(sessions, /_max: \{ line: true \}/);
  assert.match(sessions, /lastLine/);

  const hook = read("src", "features", "sermon-captions", "use-caption-session.ts");
  assert.match(hook, /function beginStreaming\(/);
  assert.match(hook, /async function resumeStreaming\(/);
  assert.match(hook, /canResumeSession\(/);
  assert.match(hook, /claimStreamLock\(/);
  assert.match(hook, /saveOperatorInput\(/);
  assert.match(hook, /loadOperatorInput\(/);
  assert.match(hook, /new CaptionAssembler\(startAfterLine\)/);
  assert.match(hook, /Captions are already running in another tab of this browser/);
  assert.match(hook, /Press Stop current session, then Start captions/);
  assert.match(hook, /Captions resumed after the page reloaded/);
  assert.match(read("src", "features", "sermon-captions", "caption-session-api.ts"), /lastLine\?: number/);

  // The booth checklist, in docs and in the help.
  const checklistPath = join(process.cwd(), "docs", "worship", "captions-booth-checklist.md");
  assert.equal(existsSync(checklistPath), true);
  const checklist = readFileSync(checklistPath, "utf8");
  for (const phrase of ["Switch to another tab for 10 minutes", "Minimize the window", "Go to Services and back", "Let the screen dim", "Opera GX", "Reload the page", "Close the tab", "Put the computer to sleep"]) {
    assert.ok(checklist.includes(phrase), `The checklist should cover: ${phrase}`);
  }
  const help = read("src", "features", "sermon-captions", "audio-help.tsx");
  assert.match(help, /Captions stopped when I switched tabs or windows/);
  assert.match(help, /tab sleeping/i);
  const readme = read("README.md");
  const captionsReadme = readme.slice(readme.indexOf("### Sermon Captions"));
  assert.match(captionsReadme, /reload/i);
  assert.match(captionsReadme, /captions-booth-checklist/);
}

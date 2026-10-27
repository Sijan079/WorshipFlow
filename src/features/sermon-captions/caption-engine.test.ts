import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { captionLiveButtonTone } from "./caption-ui.ts";
import { createTicker } from "./heartbeat-ticker.ts";
import { createWakeLockKeeper } from "./wake-lock.ts";

function read(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

function feature(name: string) {
  return read("src", "features", "sermon-captions", name);
}

class FakeWorker {
  static created: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  posted: unknown[] = [];
  terminated = false;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeWorker.created.push(this);
  }
  postMessage(message: unknown) { this.posted.push(message); }
  terminate() { this.terminated = true; }
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

// Captions keep running when the page is left or the window loses focus: the engine lives in the app
// shell, its timers run in a worker, the screen is kept awake, and leaving asks first.
export async function runCaptionEngineTests() {
  // The heartbeat runs in a worker, because a hidden tab slows main-thread timers and the public page
  // would then show "interrupted". A worker timer is not slowed that way. It falls back to a plain
  // timer where workers are unavailable.
  let ticks = 0;
  const revoked: string[] = [];
  const worked = createTicker(5000, () => { ticks += 1; }, {
    Worker: FakeWorker as unknown as typeof Worker,
    createObjectURL: () => "blob:ticker",
    revokeObjectURL: (url) => { revoked.push(url); },
  });
  assert.equal(worked.usingWorker, true);
  const worker = FakeWorker.created[0];
  assert.equal(worker.url, "blob:ticker");
  worker.onmessage?.({ data: 1 });
  worker.onmessage?.({ data: 1 });
  assert.equal(ticks, 2);
  worked.stop();
  assert.equal(worker.terminated, true);
  assert.deepEqual(revoked, ["blob:ticker"]);
  worker.onmessage?.({ data: 1 });
  assert.equal(ticks, 2, "a stopped ticker is silent");
  worked.stop();
  assert.deepEqual(revoked, ["blob:ticker"], "stopping twice is safe");

  const timers: Array<{ fn: () => void; ms: number }> = [];
  const cleared: number[] = [];
  let fallbackTicks = 0;
  const fallback = createTicker(5000, () => { fallbackTicks += 1; }, {
    Worker: undefined,
    setInterval: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearInterval: (id) => { cleared.push(id); },
  });
  assert.equal(fallback.usingWorker, false);
  assert.equal(timers[0].ms, 5000);
  timers[0].fn();
  assert.equal(fallbackTicks, 1);
  fallback.stop();
  assert.deepEqual(cleared, [1]);

  // A worker the page is not allowed to create (a Content Security Policy) also falls back.
  class RefusedWorker { constructor() { throw new Error("blocked"); } }
  const blocked = createTicker(1000, () => undefined, {
    Worker: RefusedWorker as unknown as typeof Worker,
    createObjectURL: () => "blob:x",
    revokeObjectURL: () => undefined,
    setInterval: () => 7,
    clearInterval: () => undefined,
  });
  assert.equal(blocked.usingWorker, false);
  blocked.stop();

  // The screen stays awake while live, is taken again when the tab returns, and failing is quiet.
  let requests = 0;
  let releases = 0;
  const listeners = new Map<string, () => void>();
  const doc = {
    hidden: false,
    addEventListener: (type: string, fn: () => void) => { listeners.set(type, fn); },
    removeEventListener: (type: string) => { listeners.delete(type); },
  };
  const nav = { wakeLock: { request: async () => { requests += 1; return { release: async () => { releases += 1; } }; } } };
  const keeper = createWakeLockKeeper({ nav, doc });
  await flush();
  assert.equal(requests, 1);
  doc.hidden = true;
  listeners.get("visibilitychange")?.();
  await flush();
  assert.equal(requests, 1, "nothing is requested while the tab is hidden");
  doc.hidden = false;
  listeners.get("visibilitychange")?.();
  await flush();
  assert.equal(requests, 2, "the lock is taken again when the tab is visible");
  keeper.release();
  await flush();
  assert.equal(releases, 1);
  assert.equal(listeners.size, 0);
  const quiet = createWakeLockKeeper({ nav: {}, doc: { hidden: false, addEventListener: () => undefined, removeEventListener: () => undefined } });
  quiet.release();
  const refused = createWakeLockKeeper({
    nav: { wakeLock: { request: async () => { throw new Error("denied"); } } },
    doc: { hidden: false, addEventListener: () => undefined, removeEventListener: () => undefined },
  });
  await flush();
  refused.release();

  // The floating button shows the state: purple while live, amber while recovering, red when it needs attention.
  assert.equal(captionLiveButtonTone("live"), "live");
  for (const state of ["starting", "reconnecting", "stopping"] as const) assert.equal(captionLiveButtonTone(state), "warning");
  assert.equal(captionLiveButtonTone("error"), "danger");

  // The engine lives above the pages, so moving around the app does not stop it.
  const layout = read("src", "app", "w", "[workspaceSlug]", "layout.tsx");
  assert.match(layout, /<CaptionEngineProvider workspaceSlug=\{workspaceSlug\}>/);
  assert.match(layout, /<WorkspaceShell workspaceSlug=\{workspaceSlug\}>/);
  const engine = feature("caption-engine.tsx");
  assert.match(engine, /createContext</);
  assert.match(engine, /export function useCaptionEngine\(/);
  assert.match(engine, /export function useOptionalCaptionEngine\(/);
  // It only asks the server about sessions for people who can view captions (a refused request is
  // reported to error notifications), and shares the shell's own session query.
  assert.match(engine, /queryKey: \["auth", "session", workspaceSlug\]/);
  assert.match(engine, /canViewCaptions/);
  assert.match(engine, /useCaptionSession\(\{ inputId: input\.id, inputLabel: input\.label, notify: showToast, enabled, onInputRestored: setInput \}\)/);
  // One toast viewport, one stop question, one live-database question, one button: all owned here.
  assert.equal((engine.match(/<PAPToastViewport/g) ?? []).length, 1);
  assert.match(engine, /<StopConfirmDialog/);
  assert.match(engine, /<DevDatabaseDialog/);
  assert.match(engine, /<CaptionLiveButton/);
  assert.match(engine, /usePathname\(\)/);
  assert.match(engine, /useLiveGuards\(running\)/);
  assert.match(engine, /\{stopOpen && \(running \|\| captions\.session\) \? \(/);
  assert.match(engine, /function requestStart\(\) \{\s*setStopOpen\(false\);/);
  assert.match(engine, /captions\.devAgainstLiveDatabase/);
  // The button is hidden on the Captions page itself, which already shows the state.
  assert.match(engine, /pathname === `\/w\/\$\{workspaceSlug\}\/captions`/);

  const hook = feature("use-caption-session.ts");
  assert.match(hook, /enabled: boolean/);
  assert.match(hook, /if \(!enabled\) return;/);
  assert.match(hook, /createTicker\(/);
  assert.doesNotMatch(hook, /presenceTimerRef\.current = window\.setInterval/);
  assert.match(hook, /devAgainstLiveDatabase/);

  const guards = feature("use-live-guards.ts");
  assert.match(guards, /beforeunload/);
  assert.match(guards, /createWakeLockKeeper\(/);
  assert.match(guards, /returnValue = ""/);

  // The page displays the engine and keeps only its own dialogs.
  const page = feature("sermon-captions-page.tsx");
  assert.match(page, /useCaptionEngine\(\)/);
  assert.doesNotMatch(page, /useCaptionSession\(|usePAPToasts|PAPToastViewport|setStopOpen|<StopConfirmDialog/);
  assert.match(page, /onStop=\{engine\.requestStop\}/);
  assert.match(page, /onStopExisting=\{engine\.requestStop\}/);
  assert.match(page, /onStart=\{startCaptions\}/);

  // The sign-out question warns when captions are live.
  const shell = read("src", "components", "workspace-shell.tsx");
  assert.match(shell, /useOptionalCaptionEngine\(/);
  assert.match(shell, /Captions are live\. Signing out will stop them for everyone reading\./);

  // The microphone is allowed on every workspace page, not only the Captions page: the policy comes from
  // the page that first loaded, so a booth that opened Services first could not start captions.
  const config = read("next.config.ts");
  assert.match(config, /source: "\/w\/:workspaceSlug\/:path\*"/);
  assert.doesNotMatch(config, /source: "\/w\/:workspaceSlug\/captions"/);
  const policyStart = config.indexOf('source: "/w/:workspaceSlug/:path*"');
  assert.match(config.slice(policyStart, policyStart + 400), /microphone=\(self\)/);

  // The dev-database question.
  const dialog = feature("dev-database-dialog.tsx");
  assert.match(dialog, /<DialogTitle[^>]*>Start on the Live Database\?<\/DialogTitle>/);
  assert.match(dialog, /Test captions will appear on the congregation link/);
  assert.match(dialog, /autoFocus/);
  assert.match(dialog, />Cancel</);
  assert.match(dialog, /Yes, I am sure/);
  assert.match(dialog, /ui-modal-close/);
  assert.doesNotMatch(dialog, /apiFetch|fetch\(|useRef|sessionStorage/);

  // The floating live button: purple pulse at the bottom right, below dialogs, opening a small panel.
  const button = feature("caption-live-button.tsx");
  assert.match(button, /fixed/);
  assert.match(button, /bottom-/);
  assert.match(button, /right-/);
  assert.match(button, /z-40/);
  assert.match(button, /h-14/); // a large target, now a pill with the elapsed time
  assert.match(button, /animate-ping/);
  assert.match(button, /Popover/);
  assert.match(button, /Open Captions/);
  assert.match(button, /Stop captions/);
  assert.match(button, /ui-btn-danger-solid/);
  assert.match(button, /captionLiveButtonTone\(/);
  assert.match(button, /aria-label=\{/);
  assert.match(button, /size-8|h-6 w-6|h-7 w-7/);
  assert.doesNotMatch(button, /apiFetch|fetch\(|useRef|sessionStorage|#[0-9a-fA-F]{3,8}\b/);

  // The design record: purple also marks something running live for you, and the button is logged.
  const design = read("DESIGN.md");
  assert.match(design, /also marks something running live for you/);
  assert.match(design, /one floating button/i);
  const log = read("docs", "design", "decisions.md");
  assert.match(log, /### The floating live button/);
  assert.match(log, /Status: Built/);
  assert.match(read("docs", "changes", "20261027.md"), /floating live button/i);
}

export type CaptionRunState = "idle" | "starting" | "live" | "reconnecting" | "error" | "stopping";
export type CaptionTone = "success" | "warning" | "danger" | "neutral";

type AudioDevice = { kind: string; deviceId: string; label: string };

// Before the browser has microphone permission it lists a single input with no id and no name.
// An empty id cannot be chosen and would collide with "nothing selected", so it is left out.
export function usableAudioInputs(devices: readonly AudioDevice[]) {
  const inputs = devices.filter((device) => device.kind === "audioinput" && device.deviceId !== "");
  return inputs.map((device, index) => ({
    value: device.deviceId,
    label: device.label || `Recording input ${index + 1}`,
  }));
}

// A status is a small dot and a label. Red means an error only.
export function captionStatus(state: CaptionRunState, hasSession: boolean, paused = false): { label: string; tone: CaptionTone } {
  if (paused && state === "live") return { label: "Paused", tone: "warning" };
  if (state === "live") return { label: "Live", tone: "success" };
  if (state === "reconnecting") return { label: "Reconnecting", tone: "warning" };
  if (state === "error") return { label: "Needs attention", tone: "danger" };
  if (state === "starting") return { label: "Starting", tone: "warning" };
  if (state === "stopping") return { label: "Stopping", tone: "warning" };
  return hasSession ? { label: "Session active", tone: "neutral" } : { label: "Ready to start", tone: "neutral" };
}

// While captions hold the input, the level test must not open the same device a second time.
export function captionIsRunning(state: CaptionRunState) {
  return state !== "idle";
}

// The floating live button: purple while live (it is a button running something for you), amber while
// starting or recovering, red when it needs attention.
export type LiveButtonTone = "live" | "warning" | "danger";

export function captionLiveButtonTone(state: CaptionRunState): LiveButtonTone {
  if (state === "error") return "danger";
  if (state === "starting" || state === "reconnecting" || state === "stopping") return "warning";
  return "live";
}

// Elapsed time on the live bar: 4:09, or 1:02:05 past an hour.
export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? hours + ":" + String(minutes).padStart(2, "0") + ":" + seconds : minutes + ":" + seconds;
}

const LIVE_TITLE_PREFIX = "● LIVE · ";

// The browser tab title while captions run, so the operator can see it from another tab.
export function captionTitle(title: string, live: boolean) {
  const base = title.startsWith(LIVE_TITLE_PREFIX) ? title.slice(LIVE_TITLE_PREFIX.length) : title;
  return live ? LIVE_TITLE_PREFIX + base : base;
}

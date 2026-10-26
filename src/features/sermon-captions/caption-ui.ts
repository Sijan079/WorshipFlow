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
export function captionStatus(state: CaptionRunState, hasSession: boolean): { label: string; tone: CaptionTone } {
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

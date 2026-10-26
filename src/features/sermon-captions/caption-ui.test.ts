import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { captionIsRunning, captionStatus, usableAudioInputs } from "./caption-ui.ts";

function read(...segments: string[]) {
  return readFileSync(join(process.cwd(), "src", "features", "sermon-captions", ...segments), "utf8");
}

export function runCaptionUiTests() {
  // Before the browser has microphone permission it lists one input with no id and no name.
  // That entry cannot be chosen, and an empty id would collide with the "nothing selected" value.
  const devices = [
    { kind: "audioinput", deviceId: "", label: "" },
    { kind: "audioinput", deviceId: "line-in", label: "Line In (Realtek)" },
    { kind: "audiooutput", deviceId: "speakers", label: "Speakers" },
    { kind: "audioinput", deviceId: "usb", label: "" },
  ];
  assert.deepEqual(usableAudioInputs(devices), [
    { value: "line-in", label: "Line In (Realtek)" },
    { value: "usb", label: "Recording input 2" },
  ]);
  assert.deepEqual(usableAudioInputs([{ kind: "audioinput", deviceId: "", label: "" }]), []);
  assert.deepEqual(usableAudioInputs([]), []);

  // Status is a dot and a label. Red is for errors only; waiting and finished are neutral.
  assert.deepEqual(captionStatus("live", true), { label: "Live", tone: "success" });
  assert.deepEqual(captionStatus("reconnecting", true), { label: "Reconnecting", tone: "warning" });
  assert.deepEqual(captionStatus("error", true), { label: "Needs attention", tone: "danger" });
  assert.deepEqual(captionStatus("starting", true), { label: "Starting", tone: "warning" });
  assert.deepEqual(captionStatus("stopping", true), { label: "Stopping", tone: "warning" });
  assert.deepEqual(captionStatus("idle", true), { label: "Session active", tone: "neutral" });
  assert.deepEqual(captionStatus("idle", false), { label: "Ready to start", tone: "neutral" });

  // While captions use the input, the level test must not hold the same device.
  assert.equal(captionIsRunning("idle"), false);
  assert.equal(captionIsRunning("starting"), true);
  assert.equal(captionIsRunning("live"), true);
  assert.equal(captionIsRunning("reconnecting"), true);
  assert.equal(captionIsRunning("error"), true);
  assert.equal(captionIsRunning("stopping"), true);

  // One screen in a straight line: no folder tabs, no native select.
  const page = read("sermon-captions-page.tsx");
  const audioStep = read("audio-input-step.tsx");
  assert.doesNotMatch(page, /role="tablist"/);
  assert.doesNotMatch(page, /role="tab"/);
  assert.doesNotMatch(page, /borderTopLeftRadius/);
  assert.doesNotMatch(audioStep, /<select/);
  assert.match(audioStep, /ProductionSelect/);
  assert.match(audioStep, /labelClassName=\{FIELD_LABEL_CLASS\}/);
  assert.match(read("use-audio-inputs.ts"), /usableAudioInputs\(/);

  // Separation of concerns on one page. The page only composes; it never talks to the network.
  assert.match(page, /useCaptionSession\(/);
  assert.match(page, /<CaptionControls/);
  assert.match(page, /<CaptionMessage/);
  // The next action sits at the top right, like Add person and Add service, never inside a card.
  const header = page.slice(page.indexOf('<section className="ui-page-header'), page.indexOf("</section>"));
  assert.match(header, /sm:justify-between/);
  assert.match(header, /<CaptionControls/);
  assert.doesNotMatch(page.slice(page.indexOf("</section>")), /<CaptionControls/);
  assert.match(page, /<CaptionPreview/);
  assert.match(page, /<ViewerLink/);
  assert.match(page, /usePAPToasts/);
  assert.match(page, /PAPToastViewport/);
  assert.doesNotMatch(page, /apiFetch|fetch\(|sessionStorage|MediaRecorder|getUserMedia|useEffect/);

  // Audio input is a setting, not a step on the page. An options icon beside Start captions opens
  // it in a dialog; the page itself shows only which input is chosen. The dialog is mounted only
  // while open, so closing it ends the level test and frees the device.
  const settingsButton = read("audio-settings-button.tsx");
  const settingsDialog = read("audio-settings-dialog.tsx");
  assert.match(header, /<AudioSettingsButton/);
  assert.match(page, /\{audioOpen \? <AudioSettingsDialog/);
  assert.doesNotMatch(page, /<AudioInputStep/);

  // From, To and the chosen input live behind one information icon. They are read on request, so
  // the card stays quiet. The control is icon-only, so it carries a label and a tooltip.
  const info = read("caption-info.tsx");
  assert.match(page, /<CaptionInfo\b/);
  assert.doesNotMatch(page, /<AudioInputSummary/);
  assert.match(info, /Popover/);
  assert.match(info, /aria-label="Caption details"/);
  assert.match(info, /title="Caption details"/);
  assert.match(info, /min-h-11 min-w-11/);
  assert.match(info, /Tagalog & English \(Speech\)/);
  assert.match(info, /English \(Text\)/);
  assert.match(info, /From/);
  assert.match(info, /To/);
  assert.match(info, /Audio input/);
  assert.match(info, /No audio input chosen yet/);

  // The options button is quiet: no border and a transparent background.
  assert.match(settingsButton, /bg-transparent/);
  assert.match(settingsButton, /border-0/);
  assert.doesNotMatch(settingsButton, /ui-btn-secondary/);

  // Live pulses so it is noticed from across the booth; other states stay still.
  const status = read("caption-status.tsx");
  assert.match(status, /state === "live"/);
  assert.match(status, /animate-ping/);

  // What the page is doing is background text, so it is muted.
  assert.match(read("caption-message.tsx"), /text-\[var\(--text-muted\)\]/);
  assert.doesNotMatch(read("caption-message.tsx"), /text-secondary/);
  assert.doesNotMatch(page, /caption-step-input|1\. Choose/);
  assert.equal(page.match(/ui-surface-elevated/g)?.length, 1);
  assert.match(settingsButton, /aria-label="Audio input settings"/);
  assert.match(settingsButton, /min-h-11 min-w-11/);
  assert.match(settingsDialog, /<Dialog\b/);
  assert.match(settingsDialog, /<AudioInputStep/);
  assert.match(settingsDialog, /ui-modal-close/);
  assert.match(settingsDialog, /aria-label="Close"/);
  assert.match(settingsDialog, /Ui24R speaking microphones/);
  // Start is never a dead button: with no input chosen it opens the settings instead.
  assert.match(page, /input\.id \? [\s\S]*?: setAudioOpen\(true\)/);
  assert.doesNotMatch(read("caption-controls.tsx"), /hasInput/);

  // The card opens with what goes in and what comes out, not a title. The region keeps an
  // invisible label for screen readers.
  assert.doesNotMatch(page, /From: Tagalog|To: English/);
  assert.doesNotMatch(page, /<h2[^>]*>Live captions<\/h2>/);
  assert.doesNotMatch(page, /Tagalog and English speech/);
  assert.match(page, /aria-label="Live captions"/);

  // The card is filled edge to edge: no narrow column inside it, and the caption preview takes
  // the height the card has left.
  assert.doesNotMatch(page, /max-w-(3xl|4xl)/);
  assert.match(page, /flex min-h-\[calc\(100dvh-6\.5rem\)\] flex-col/);
  assert.match(page, /flex flex-1 flex-col/);
  assert.match(read("caption-preview.tsx"), /flex-1/);

  // The network layer knows nothing about React; the hooks hold state and effects, not markup.
  const api = read("caption-session-api.ts");
  assert.doesNotMatch(api, /from "react"|useState|useEffect|sessionStorage/);
  assert.match(api, /export (async )?function (fetchActiveSession|startSession|stopSession|publishLine|fetchDeepgramToken)/);
  assert.match(api, /keepalive: true/);
  for (const hook of ["use-caption-session.ts", "use-audio-inputs.ts"]) {
    assert.doesNotMatch(read(hook), /<[A-Za-z][^>]*\/?>\s*$|className=/m);
  }
  assert.match(read("use-caption-session.ts"), /stopSessionOnLeave\(/);
  assert.match(read("use-caption-session.ts"), /fetchActiveSession\(/);

  // Display components take props. They do not fetch, hold refs, or touch browser storage.
  for (const file of ["audio-input-step.tsx", "audio-settings-button.tsx", "audio-settings-dialog.tsx", "caption-info.tsx", "caption-controls.tsx", "caption-message.tsx", "caption-preview.tsx", "caption-status.tsx", "viewer-link.tsx"]) {
    const source = read(file);
    assert.doesNotMatch(source, /apiFetch|fetch\(|useRef|sessionStorage|getUserMedia|MediaRecorder/, file);
  }
  assert.doesNotMatch(read("caption-controls.tsx"), /useEffect/);
  assert.doesNotMatch(read("caption-preview.tsx"), /useEffect/);

  // Status is a dot plus a label; the controls explain in plain sentences with a live region.
  assert.match(read("caption-status.tsx"), /captionStatus\(/);
  assert.match(read("caption-status.tsx"), /rounded-full/);
  assert.match(read("caption-message.tsx"), /role="status"/);
  assert.doesNotMatch(read("caption-controls.tsx"), /role="status"/);
  assert.match(read("caption-controls.tsx"), /ui-btn-primary/);
  assert.match(read("viewer-link.tsx"), /min-h-11/);
  assert.doesNotMatch(read("viewer-link.tsx"), /min-h-10 /);

  // Every start, stop and copy gives a toast.
  const hook = read("use-caption-session.ts");
  assert.match(hook, /notify\(/);
  assert.match(hook, /Viewer link copied/);
}

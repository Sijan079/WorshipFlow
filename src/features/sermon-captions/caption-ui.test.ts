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

  // Stopping is a decision, not a stray click. Both stop buttons ask first, say what happens, and
  // default to Cancel. The question closes by itself if the session ends while it is open.
  const stopDialog = read("stop-confirm-dialog.tsx");
  assert.match(page, /onStop=\{\(\) => setStopOpen\(true\)\}/);
  assert.match(page, /onStopExisting=\{\(\) => setStopOpen\(true\)\}/);
  assert.doesNotMatch(page, /onStop=\{\(\) => void captions\.stop\(\)\}/);
  assert.doesNotMatch(page, /onStopExisting=\{\(\) => void captions\.stopExisting\(\)\}/);
  assert.match(page, /\{stopOpen && \(running \|\| captions\.session\) \? \(\s*<StopConfirmDialog/);
  assert.match(page, /running \? captions\.stop\(\) : captions\.stopExisting\(\)/);
  // A question left open by a session that ended on its own must not come back on the next Start.
  assert.match(page, /function startCaptions\(\) \{\s*setStopOpen\(false\);/);
  assert.match(page, /onStart=\{startCaptions\}/);
  assert.match(stopDialog, /<Dialog\b/);
  assert.match(stopDialog, /<DialogTitle[^>]*>Stop Captions\?<\/DialogTitle>/);
  assert.match(stopDialog, /Everyone reading will stop getting captions/);
  assert.match(stopDialog, /stay on the link for one hour/);
  assert.match(stopDialog, /autoFocus/);
  assert.match(stopDialog, />Cancel</);
  assert.match(stopDialog, /Yes, I am sure/);
  assert.match(stopDialog, /ui-modal-close/);
  assert.match(stopDialog, /aria-label="Close"/);

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

  // The dialog is short: a title in title case, an information icon for where the audio goes, the
  // input picker, and one collapsible help area. The subtitle and the opening status line are gone.
  assert.match(settingsDialog, /<DialogTitle[^>]*>Audio Input<\/DialogTitle>/);
  assert.doesNotMatch(settingsDialog, /Select the PC input receiving/);
  assert.doesNotMatch(settingsDialog, /Ui24R speaking microphones|The meter shows all sound/);
  assert.match(settingsDialog, /<DialogDescription className="sr-only">/);
  assert.match(settingsDialog, /<AudioPrivacyInfo/);
  assert.match(settingsDialog, /<AudioHelp/);
  assert.doesNotMatch(read("use-audio-inputs.ts"), /Choose the PC input carrying the Ui24R AUX feed/);
  assert.match(read("use-audio-inputs.ts"), /useState\(""\)/);
  assert.match(read("audio-input-step.tsx"), /audio\.message \? /);

  // The level test is a microphone icon with the word Test. At rest it looks like a secondary
  // button without its border; on hover and while a test runs it is purple with white text and icon.
  const step = read("audio-input-step.tsx");
  assert.match(step, /import \{ Mic \} from "lucide-react"/);
  assert.match(step, /aria-pressed=\{testing\}/);
  // The word "Test" sits beside the icon. The accessible name still contains it, and the button
  // is a toggle (pressed while a test runs), so the name does not change.
  assert.match(step, /aria-label="Test audio input"/);
  assert.match(step, /title=\{testing \? "Stop input test" : "Test audio input"\}/);
  assert.match(step, /<span>Test<\/span>/);
  assert.match(step, /gap-2 px-3/);
  // At rest it looks like our other secondary buttons (their fill and ink) but with no border.
  assert.match(step, /border-0 bg-\[var\(--surface-panel-strong\)\] text-\[var\(--action-secondary-ink\)\]/);
  assert.doesNotMatch(step.slice(step.indexOf("const TEST_OFF"), step.indexOf("const FOCUS")), /ui-btn-secondary/);
  // The hover and active colour is the secondary accent (a trial), not the purple primary fill.
  assert.match(step, /hover:bg-\[var\(--action-secondary-accent-bg\)\] hover:text-\[var\(--action-secondary-accent-ink\)\]/);
  assert.match(step, /bg-\[var\(--action-secondary-accent-bg\)\] text-\[var\(--action-secondary-accent-ink\)\]/);
  assert.match(step, /min-h-11/);
  // A soft shadow lifts it off the dialog, the same one the raised fields use.
  assert.match(step, /shadow-\[var\(--elevation-subtle\)\]/);
  assert.doesNotMatch(step, />Test audio input</);
  assert.doesNotMatch(step, />Stop input test</);

  // No cards inside cards. A surface (the page card, a dialog) holds panels that extend vertically,
  // divided by hairline rules, never another bordered or rounded box. Floating popovers are exempt.
  const design = readFileSync(join(process.cwd(), "DESIGN.md"), "utf8");
  assert.match(design, /Never nest cards/);
  assert.match(design, /panel/i);
  const NESTED_BOX = /rounded-\[var\(--radius-card\)\]|\bborder border-|\brounded-(md|lg|xl)\b/;
  for (const file of ["audio-help.tsx", "caption-preview.tsx"]) {
    assert.doesNotMatch(read(file), NESTED_BOX, `${file} must not draw a box inside its surface`);
  }
  const qrDialog = read("share-dialog.tsx");
  assert.doesNotMatch(qrDialog.slice(qrDialog.indexOf("{link ? ("), qrDialog.indexOf("Copy link")), NESTED_BOX);
  assert.match(read("audio-help.tsx"), /border-t border-\[var\(--rule-default\)\]/);
  assert.match(page, /divide-y divide-\[var\(--rule-default\)\]/);
  assert.match(read("caption-preview.tsx"), /bg-\[var\(--surface-panel-alt\)\]/);
  assert.match(readFileSync(join(process.cwd(), "docs", "changes", "20261027.md"), "utf8"), /Never nest cards/);

  // Where the audio goes is disclosed behind an information icon beside the title.
  const privacy = read("audio-privacy-info.tsx");
  assert.match(privacy, /Popover/);
  assert.match(privacy, /aria-label="Where does the audio go\?"/);
  assert.match(privacy, /min-h-11 min-w-11/);
  assert.match(privacy, /Deepgram/);
  assert.match(privacy, /Azure Translator/);
  assert.match(privacy, /stays on this computer/);

  // Help is collapsed by default, split into Setup and Troubleshooting, in plain steps.
  const help = read("audio-help.tsx");

  // The guide fits any church's booth: it names no particular mixer, and covers a computer with no
  // line input (a USB audio interface) and both Windows and Mac sound settings.
  for (const file of ["audio-help.tsx", "use-audio-inputs.ts", "audio-input-step.tsx", "audio-settings-dialog.tsx", "audio-privacy-info.tsx", "caption-info.tsx", "sermon-captions-page.tsx"]) {
    assert.doesNotMatch(read(file), /Ui24R|Soundcraft|\bAUX\b/, `${file} must not name one mixer`);
  }
  assert.match(help, /mixer or sound desk/);
  assert.match(help, /USB audio interface/);
  assert.match(help, /Windows/);
  assert.match(help, /Mac/);
  assert.doesNotMatch(readFileSync(join(process.cwd(), "README.md"), "utf8").split("### Sermon Captions")[1] ?? "", /Ui24R/);
  // One collapsible area holding two collapsible sub-sections, all closed to begin with. They open
  // and close smoothly: Radix Collapsible keeps the height, and a CSS animation uses it.
  assert.match(help, /import \{ Collapsible \} from "radix-ui"/);
  assert.equal((help.match(/<Section /g) ?? []).length, 3);
  assert.match(help, /<Collapsible\.Root/);
  assert.match(help, /<Collapsible\.Trigger/);
  assert.match(help, /<Collapsible\.Content className="ui-collapsible-content"/);
  assert.doesNotMatch(help, /defaultOpen|<details|<summary/);
  assert.match(help, /title="Setup and troubleshooting"/);
  assert.match(help, /title="Setup"/);
  assert.match(help, /title="Troubleshooting"/);
  assert.match(help, /\[&\[data-state=open\]>svg\]:rotate-180/);
  assert.doesNotMatch(help, /<h3/);
  const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
  assert.match(css, /@keyframes ui-collapsible-open \{[\s\S]*?height: 0[\s\S]*?var\(--radix-collapsible-content-height\)/);
  assert.match(css, /@keyframes ui-collapsible-close/);
  assert.match(css, /\.ui-collapsible-content\[data-state="open"\] \{\s*animation: ui-collapsible-open var\(--dur-base\) var\(--ease-out\)/);
  assert.match(css, /\.ui-collapsible-content\[data-state="closed"\] \{\s*animation: ui-collapsible-close var\(--dur-base\) var\(--ease-out\)/);
  assert.match(css, /\.ui-collapsible-content \{[^}]*overflow: hidden/);
  assert.match(help, /<ol/);
  assert.ok((help.match(/^ {2}"/gm) ?? []).length >= 8, "Expected at least eight setup steps");
  assert.ok((help.match(/problem: "/g) ?? []).length >= 10, "Expected at least ten troubleshooting entries");
  assert.match(help, /SETUP_STEPS\.map/);
  assert.match(help, /TROUBLESHOOTING\.map/);
  for (const phrase of ["line input", "Allow microphone access", "Press Test", "Start captions", "Stop current session", "Needs attention", "Another app"]) {
    assert.ok(help.includes(phrase), `Expected the help to mention: ${phrase}`);
  }
  assert.doesNotMatch(help, /text-\[(1[01]|[0-9])px\]/);
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
  for (const file of ["audio-input-step.tsx", "audio-settings-button.tsx", "audio-settings-dialog.tsx", "audio-help.tsx", "audio-privacy-info.tsx", "caption-info.tsx", "caption-controls.tsx", "caption-message.tsx", "caption-preview.tsx", "caption-status.tsx", "share-button.tsx", "share-dialog.tsx", "stop-confirm-dialog.tsx"]) {
    const source = read(file);
    assert.doesNotMatch(source, /apiFetch|fetch\(|useRef|sessionStorage|getUserMedia|MediaRecorder/, file);
  }
  assert.doesNotMatch(read("caption-controls.tsx"), /useEffect/);
  assert.doesNotMatch(read("caption-preview.tsx"), /useEffect/);

  // Status is a dot plus a label; the controls explain in plain sentences with a live region.
  assert.match(read("caption-status.tsx"), /captionStatus\(/);
  assert.match(read("caption-status.tsx"), /rounded-full/);
  // The label is the same colour as its dot, in every state, including "Ready to start".
  assert.match(read("caption-status.tsx"), /style=\{\{ color: DOT\[status\.tone\] \}\}/);
  assert.doesNotMatch(read("caption-status.tsx"), /text-\[var\(--text-(secondary|success|warning|danger)\)\]/);
  assert.match(read("caption-message.tsx"), /role="status"/);
  assert.doesNotMatch(read("caption-controls.tsx"), /role="status"/);
  assert.match(read("caption-controls.tsx"), /ui-btn-primary/);
  // Both stop buttons are red, to say this ends the broadcast. Red is visible at rest, not only on hover.
  const controls = read("caption-controls.tsx");
  assert.equal((controls.match(/ui-btn-danger-solid/g) ?? []).length, 2);
  assert.doesNotMatch(controls, /ui-btn-secondary/);
  const dangerCss = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
  const solidStart = dangerCss.indexOf(".ui-btn-danger-solid {");
  const solidRule = dangerCss.slice(solidStart, dangerCss.indexOf("}", solidStart));
  assert.match(solidRule, /background: var\(--state-danger\)/);
  assert.match(solidRule, /color: var\(--action-primary-ink\)/);
  // The quiet Delete style is untouched: Settings, People, the error list and the Formatter use it.
  const quietStart = dangerCss.indexOf(".ui-btn-danger {");
  assert.match(dangerCss.slice(quietStart, dangerCss.indexOf("}", quietStart)), /background: transparent/);
  assert.match(readFileSync(join(process.cwd(), "DESIGN.md"), "utf8"), /`ui-btn-danger-solid`[^.]*is Built/);

  // The feel and the reasoning behind this screen are written down in DESIGN.md, so the next screen
  // starts from them. Each decision keeps its "why".
  const feel = readFileSync(join(process.cwd(), "DESIGN.md"), "utf8");
  assert.match(feel, /^## Feel and reasoning/m);
  for (const phrase of [
    "One screen, no tabs",
    "The next action sits at the top right",
    "Quiet controls",
    "A status is a signal",
    "Information on request",
    "Help is closed by default",
    "Never nest cards",
    "A deliberate action needs an aware yes",
    "Yes, I am sure",
    "default to Cancel",
    "Things open and close smoothly",
    "One link, one control",
    "Checking a new screen",
  ]) {
    assert.ok(feel.includes(phrase), `DESIGN.md should record: ${phrase}`);
  }
  // DESIGN.md keeps the feel, one line per decision, and the checklist. The reasoning lives in a log
  // by topic (not one file per page), where every decision keeps its why.
  assert.match(feel, /docs\/design\/decisions\.md/);
  assert.ok((feel.match(/\*\*Why:\*\*/g) ?? []).length < 3, "DESIGN.md should link to the log, not repeat every why");
  const log = readFileSync(join(process.cwd(), "docs", "design", "decisions.md"), "utf8");
  assert.ok((log.match(/\*\*Why:\*\*/g) ?? []).length >= 12, "Each recorded decision keeps its why");
  for (const topic of ["## Pages and structure", "## Controls", "## Status", "## Information", "## Help", "## Dialogs and confirmations", "## Motion", "## Unity and wording"]) {
    assert.ok(log.includes(topic), `decisions.md should have ${topic}`);
  }
  assert.match(log, /Things travel from where they were to where they are, and never jump/);
  assert.match(log, /An element that does the same job looks and behaves the same everywhere in the app/);
  assert.match(log, /Status: (Built|Trial|Target)/);

  // The rules the grilling session settled are in DESIGN.md in their agreed words.
  assert.match(feel, /destructive or disruptive to an operation/);
  assert.match(feel, /Dialog titles are in Title Case/);
  assert.match(feel, /Pages that are not lists/);
  assert.match(feel, /Cancel[^.]*Done|Done[^.]*Cancel/);
  assert.match(feel, /Things travel from where they were to where they are, and never jump/);
  assert.match(feel, /Design unification pass/);
  assert.doesNotMatch(feel, /Dialog titles: Audio Input is in Title Case at the owner's request/);
  assert.doesNotMatch(feel, /accent text on hover\. It is never a status color/);
  const roadmap = readFileSync(join(process.cwd(), "docs", "core", "Roadmap.md"), "utf8");
  assert.match(roadmap, /10\. \*\*Design unification pass/);
  assert.match(roadmap, /13\. \*\*Rewrite `AGENTS\.md` and `README\.md`/);
  assert.match(readFileSync(join(process.cwd(), "docs", "changes", "20261027.md"), "utf8"), /Feel and reasoning/);

  // Changing DESIGN.md is never done alone: it goes through a grilling session with the owner first.
  const agents = readFileSync(join(process.cwd(), "AGENTS.md"), "utf8");
  assert.match(agents, /Changing `DESIGN\.md`/);
  assert.match(agents, /grilling/);
  assert.match(agents, /docs\/changes\//);
  assert.match(agents, /Do not edit `DESIGN\.md` as a side effect/);

  // Every start, stop and copy gives a toast.
  const hook = read("use-caption-session.ts");
  assert.match(hook, /notify\(/);
}

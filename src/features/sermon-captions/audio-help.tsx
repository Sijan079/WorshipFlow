"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible } from "radix-ui";

const SETUP_STEPS = [
  "On your mixer or sound desk, send the speaker's microphone to one spare output, such as an aux, bus, or matrix output. Send only the speaking microphones, not music or the band, so the captions follow the speaker.",
  "Connect that output to a line input on the computer that runs the captions, with an audio cable. If the computer has no line input, use a USB audio interface, or a USB output on the mixer if it has one.",
  "In the computer's sound settings, check that the input is switched on and not muted. On Windows, open Sound settings and look under Input (or the Recording devices list). On a Mac, open System Settings, then Sound, then Input.",
  "Open this page on that computer in Chrome or Edge (or another browser built on Chromium, such as Opera), at the church's secure address. The browser only allows microphone access on a secure address.",
  "Press Allow microphone access if the list has no names, then choose Allow when the browser asks.",
  "Under PC recording input, choose the input you connected. Its name is usually the line input, the audio interface, or the mixer's USB name.",
  "Press Test, beside the microphone icon, and speak into a microphone that is sent to that output. The button turns purple and the meter should move and say Signal present. Press it again to stop the test.",
  "Press Done, then press Start captions. Keep this page open in its own tab or window until the service ends.",
];

const TROUBLESHOOTING: Array<{ problem: string; fix: string }> = [
  { problem: "The list shows no input names", fix: "Press Allow microphone access and choose Allow when the browser asks." },
  { problem: "Microphone access was denied", fix: "Click the padlock in the address bar, set Microphone to Allow, then reload the page." },
  { problem: "No recording input was found", fix: "Check the cable or USB connection, and that the input is switched on in the computer's sound settings (Windows: Sound settings, Input. Mac: System Settings, Sound, Input). Then open this window again." },
  { problem: "The selected input is no longer available", fix: "The cable or device was unplugged. Reconnect it, then choose the input again." },
  { problem: "Could not open the selected input", fix: "Another app may be using it, such as a call, a recorder, or a streaming app. Close it and test again." },
  { problem: "The meter stays Quiet while someone speaks", fix: "Check that the speaker's microphone is sent to the output you connected and is not muted, that the output level is up, that the cable is in the line input and not the microphone socket, and that you chose the right input here." },
  { problem: "The meter moves while the microphones are quiet", fix: "The output also carries other channels, such as music or the band. Take them off that output so the captions follow the speaker only." },
  { problem: "Could not start captions", fix: "Read the message under the preview. If it says captions are not set up, or that the key was refused, ask an Admin to check the Deepgram and Azure Translator keys on the server." },
  { problem: "Connection interrupted. Reconnecting", fix: "The internet dropped. Keep this page open: it reconnects by itself and listeners keep the same link. Words spoken during the drop may be missing." },
  { problem: "The status says Needs attention", fix: "The caption stream closed because of an audio or access error. Press Stop captions, then Start captions. If it happens again, check the input and the keys." },
  { problem: "Translation interrupted", fix: "Azure Translator did not answer. Captions return when it does. If it keeps happening, ask an Admin to check the Azure key and region." },
  { problem: "A caption session is already running", fix: "Press Stop current session. If the booth crashed, you can also press Start captions after two minutes of silence: a session that has gone quiet is ended for you." },
  { problem: "Captions stopped when I switched tabs or windows", fix: "They should keep running: the page holds the connection and keeps the screen awake while captions are live, and you can move around the app. If they stopped, the browser may have put the tab to sleep. In Opera GX, turn off tab sleeping and the RAM limiter for this site, or keep the captions page in its own window. Closing the tab, shutting down or putting the computer to sleep always stops captions." },
  { problem: "The page was reloaded or closed during the service", fix: "After a reload, captions reconnect to the same session and link by themselves, using the same input. If the browser asks for the microphone again, or the page was closed, press Stop current session, then Start captions. Listeners keep the same link and follow along." },
];

const TRIGGER = "flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-semibold text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] [&[data-state=open]>svg]:rotate-180";

// One collapsible panel: a full-width row with a chevron and a hairline above it. It opens and closes
// smoothly (see .ui-collapsible-content). `indent` steps a nested panel in by one level.
function Section({ title, indent = false, children }: { title: string; indent?: boolean; children: ReactNode }) {
  return (
    <Collapsible.Root className="border-t border-[var(--rule-default)]">
      <Collapsible.Trigger className={`${TRIGGER}${indent ? " pl-4" : ""}`}>
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform duration-[var(--dur-base)]" aria-hidden="true" />
      </Collapsible.Trigger>
      <Collapsible.Content className="ui-collapsible-content">{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}

// Help for the booth team: how to set the feed up the first time, and what to do when something goes
// wrong. Stacked panels divided by hairline rules, each closed to begin with and opening on its own,
// indented one step per level, with no boxes inside the dialog. It takes no props.
export default function AudioHelp() {
  return (
    <Section title="Setup and troubleshooting">
      <Section title="Setup" indent>
        <ol className="list-decimal space-y-2 pb-4 pl-12 text-sm leading-6 text-[var(--text-primary)]">
          {SETUP_STEPS.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </Section>
      <Section title="Troubleshooting" indent>
        <ul className="space-y-3 pb-4 pl-8 text-sm leading-6 text-[var(--text-primary)]">
          {TROUBLESHOOTING.map((item) => (
            <li key={item.problem}>
              <p className="font-semibold">{item.problem}</p>
              <p className="text-[var(--text-secondary)]">{item.fix}</p>
            </li>
          ))}
        </ul>
      </Section>
    </Section>
  );
}

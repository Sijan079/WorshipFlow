"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import AudioCheck from "./audio-check";
import LiveCaptions from "./live-captions";

const tabs = ["setup", "live"] as const;
type CaptionTab = (typeof tabs)[number];

export default function SermonCaptionsPage() {
  const [activeTab, setActiveTab] = useState<CaptionTab>("setup");
  const [selectedInputId, setSelectedInputId] = useState("");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    setActiveTab(tabs[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="min-h-full space-y-6 py-1 lg:px-2">
      <header className="ui-page-header max-w-2xl">
        <h1 className="ui-page-title">Sermon Captions</h1>
        <p className="ui-page-description">Prepare the booth audio feed for live English captions.</p>
      </header>

      <div>
        <div role="tablist" aria-label="Sermon Captions views" className="relative z-10 flex items-end gap-1">
          {tabs.map((tab, index) => {
            const selected = activeTab === tab;
            return (
              <button
                key={tab}
                ref={(element) => { tabRefs.current[index] = element; }}
                type="button"
                id={`caption-tab-${tab}`}
                role="tab"
                aria-controls={`caption-panel-${tab}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`min-h-11 rounded-t-[var(--radius-control)] border px-5 text-sm font-semibold focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ${selected ? "relative z-10 -mb-px border-[var(--border-default)] border-b-[var(--surface-panel-elevated)] bg-[var(--surface-panel-elevated)] text-[var(--text-primary)]" : "border-[var(--border-default)] bg-[var(--surface-panel-alt)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)]"}`}
              >
                {tab === "setup" ? "Audio setup" : "Live captions"}
              </button>
            );
          })}
        </div>

        <section
          className="ui-surface-elevated overflow-hidden"
          aria-label="Sermon Captions workspace"
          style={{ borderTopLeftRadius: activeTab === "setup" ? 0 : undefined }}
        >
        <div id="caption-panel-setup" role="tabpanel" aria-labelledby="caption-tab-setup" tabIndex={0} hidden={activeTab !== "setup"} className="p-4 sm:p-6">
          {activeTab === "setup" ? (
            <div className="max-w-3xl space-y-5">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Audio input</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Select the PC input receiving the Ui24R speech mix.</p>
              </div>
              <AudioCheck selectedId={selectedInputId} onSelectedIdChange={setSelectedInputId} />
              <div className="border-t border-[var(--rule-default)] pt-4 text-sm leading-6 text-[var(--text-secondary)]">
                <p>Ui24R speaking microphones → dedicated AUX output → worship PC Line In.</p>
                <p className="mt-1">The input test stays on this computer. Starting live captions sends this input to Deepgram and the recognized text to Azure Translator.</p>
                <p className="mt-1">The meter shows all sound on that input. If it stays active while the mics are quiet, check which mixer channels feed the AUX.</p>
              </div>
            </div>
          ) : null}
        </div>

        <div id="caption-panel-live" role="tabpanel" aria-labelledby="caption-tab-live" tabIndex={0} hidden={activeTab !== "live"} className="p-4 sm:p-6">
          <LiveCaptions inputId={selectedInputId} />
        </div>
        </section>
      </div>
    </div>
  );
}

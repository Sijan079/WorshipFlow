"use client";

import { useState } from "react";
import AudioSettingsButton from "./audio-settings-button";
import AudioSettingsDialog from "./audio-settings-dialog";
import CaptionControls from "./caption-controls";
import CaptionInfo from "./caption-info";
import { useCaptionEngine } from "./caption-engine";
import CaptionMessage from "./caption-message";
import CaptionPreview from "./caption-preview";
import CaptionStatus from "./caption-status";
import ShareButton from "./share-button";
import ShareDialog from "./share-dialog";
import { useCaptionLink } from "./use-caption-link";

// The page displays the captions engine (caption-engine.tsx), which lives above every workspace page,
// so leaving this page does not stop captions. The page keeps only its own dialogs.
export default function SermonCaptionsPage() {
  const engine = useCaptionEngine();
  const [audioOpen, setAudioOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const captionLink = useCaptionLink({ enabled: shareOpen, notify: engine.showToast });

  // With no input chosen, Start opens the audio settings instead of failing.
  function startCaptions() {
    void (engine.input.id ? engine.requestStart() : setAudioOpen(true));
  }

  return (
    <div className="flex min-h-[calc(100dvh-6.5rem)] flex-col gap-6 py-1 lg:min-h-[calc(100dvh-7rem)] lg:px-2 min-[1200px]:min-h-[calc(100dvh-3rem)]">
      <section className="ui-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="ui-page-title">Sermon Captions</h1>
          <p className="ui-page-description">Prepare the booth audio feed for live English captions.</p>
        </div>
        <div className="flex items-center gap-3">
          {engine.canShare ? <ShareButton onClick={() => setShareOpen(true)} /> : null}
          <AudioSettingsButton onClick={() => setAudioOpen(true)} />
          <CaptionControls
            state={engine.state}
            hasSession={Boolean(engine.session)}
            canOperate={engine.canOperate}
            canStopExisting={engine.canStopExisting}
            onStart={startCaptions}
            onStop={engine.requestStop}
            onStopExisting={engine.requestStop}
            paused={engine.paused}
            onPause={() => void engine.pause()}
            onResume={() => void engine.resume()}
          />
        </div>
      </section>

      <section className="ui-surface-elevated flex flex-1 flex-col divide-y divide-[var(--rule-default)]" aria-label="Live captions">
        <div className="flex items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <CaptionInfo inputLabel={engine.input.label} running={engine.running} />
          <CaptionStatus state={engine.state} hasSession={Boolean(engine.session)} paused={engine.paused} />
        </div>
        <CaptionPreview lines={engine.lines} />
        <div className="px-4 py-3 sm:px-6">
          <CaptionMessage message={engine.message} />
        </div>
      </section>

      {shareOpen ? (
        <ShareDialog
          link={captionLink.link}
          loading={captionLink.loading}
          error={captionLink.error}
          running={engine.running}
          regenerating={captionLink.regenerating}
          onCopyLink={() => void captionLink.copyLink()}
          onCopyQr={(qr) => void captionLink.copyQr(qr)}
          onRegenerate={() => void captionLink.regenerate()}
          notify={engine.showToast}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
      {audioOpen ? <AudioSettingsDialog input={engine.input} onInputChange={engine.setInput} locked={engine.running} onClose={() => setAudioOpen(false)} /> : null}
    </div>
  );
}

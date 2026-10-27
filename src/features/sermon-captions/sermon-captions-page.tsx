"use client";

import { useState } from "react";
import { PAPToastViewport, usePAPToasts } from "@/features/pap/components/pap-toasts";
import type { AudioInputChoice } from "./audio-input-step";
import AudioSettingsButton from "./audio-settings-button";
import AudioSettingsDialog from "./audio-settings-dialog";
import CaptionControls from "./caption-controls";
import CaptionInfo from "./caption-info";
import CaptionMessage from "./caption-message";
import CaptionPreview from "./caption-preview";
import CaptionStatus from "./caption-status";
import { captionIsRunning } from "./caption-ui";
import ShareButton from "./share-button";
import ShareDialog from "./share-dialog";
import StopConfirmDialog from "./stop-confirm-dialog";
import { useCaptionLink } from "./use-caption-link";
import { useCaptionSession } from "./use-caption-session";

const NO_INPUT: AudioInputChoice = { id: "", label: "" };

// The page only composes. The session hook owns what happens, and each piece below draws one
// part of the screen from props. It stays mounted for the whole visit because leaving the page
// ends the session.
export default function SermonCaptionsPage() {
  const [input, setInput] = useState<AudioInputChoice>(NO_INPUT);
  const [audioOpen, setAudioOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const { dismissToast, showToast, toasts } = usePAPToasts();
  const captions = useCaptionSession({ inputId: input.id, notify: showToast });
  const running = captionIsRunning(captions.state);
  const captionLink = useCaptionLink({ enabled: shareOpen, notify: showToast });

  // With no input chosen, Start opens the audio settings instead of failing. It also clears a stop
  // question left open by a session that ended on its own.
  function startCaptions() {
    setStopOpen(false);
    void (input.id ? captions.start() : setAudioOpen(true));
  }

  return (
    <div className="flex min-h-[calc(100dvh-6.5rem)] flex-col gap-6 py-1 lg:min-h-[calc(100dvh-7rem)] lg:px-2 min-[1200px]:min-h-[calc(100dvh-3rem)]">
      <section className="ui-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="ui-page-title">Sermon Captions</h1>
          <p className="ui-page-description">Prepare the booth audio feed for live English captions.</p>
        </div>
        <div className="flex items-center gap-3">
          {captions.canShare ? <ShareButton onClick={() => setShareOpen(true)} /> : null}
          <AudioSettingsButton onClick={() => setAudioOpen(true)} />
          <CaptionControls
            state={captions.state}
            hasSession={Boolean(captions.session)}
            canOperate={captions.canOperate}
            canStopExisting={captions.canStopExisting}
            onStart={startCaptions}
            onStop={() => setStopOpen(true)}
            onStopExisting={() => setStopOpen(true)}
          />
        </div>
      </section>

      <section className="ui-surface-elevated flex flex-1 flex-col divide-y divide-[var(--rule-default)]" aria-label="Live captions">
        <div className="flex items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <CaptionInfo inputLabel={input.label} running={running} />
          <CaptionStatus state={captions.state} hasSession={Boolean(captions.session)} />
        </div>
        <CaptionPreview lines={captions.lines} />
        <div className="px-4 py-3 sm:px-6">
          <CaptionMessage message={captions.message} />
        </div>
      </section>

      {stopOpen && (running || captions.session) ? (
        <StopConfirmDialog
          onConfirm={() => {
            setStopOpen(false);
            void (running ? captions.stop() : captions.stopExisting());
          }}
          onCancel={() => setStopOpen(false)}
        />
      ) : null}
      {shareOpen ? (
        <ShareDialog
          link={captionLink.link}
          loading={captionLink.loading}
          error={captionLink.error}
          running={running}
          regenerating={captionLink.regenerating}
          onCopyLink={() => void captionLink.copyLink()}
          onCopyQr={(qr) => void captionLink.copyQr(qr)}
          onRegenerate={() => void captionLink.regenerate()}
          notify={showToast}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
      {audioOpen ? <AudioSettingsDialog input={input} onInputChange={setInput} locked={running} onClose={() => setAudioOpen(false)} /> : null}
      <PAPToastViewport dismissToast={dismissToast} toasts={toasts} />
    </div>
  );
}

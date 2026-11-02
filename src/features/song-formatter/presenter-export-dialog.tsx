"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCopy, Download, FileText, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { triggerBrowserDownload } from "@/lib/api-client";
import { songTextFileName } from "./filename";
import { DEFAULT_LINES_PER_SLIDE, freeShowExport, sectionsFromText, songFromSections } from "./presenter";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  songTitle: string;
  onWord: () => void;
  wordPending: boolean;
};

// How many lines a slide holds. "As written" keeps every slide exactly as it is in the editor.
const SLIDE_SIZES: Array<{ value: number; label: string }> = [
  { value: 2, label: "2 lines" },
  { value: 3, label: "3 lines" },
  { value: 4, label: "4 lines" },
  { value: 0, label: "As written" },
];

const BUTTON_PRIMARY = "ui-btn-primary pressable inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60";
const BUTTON_SECONDARY = "ui-btn-secondary pressable inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60";

// The one place a song leaves the Formatter. FreeShow comes first, as a text file it imports. The words are never
// rewritten: slides are only grouped, and any line FreeShow would swallow is changed a little and listed here.
export default function PresenterExportDialog({ open, onOpenChange, text, songTitle, onWord, wordPending }: Props) {
  const [linesPerSlide, setLinesPerSlide] = useState(DEFAULT_LINES_PER_SLIDE);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    const song = songFromSections(sectionsFromText(text), { linesPerSlide });
    return { song, ...freeShowExport(song, { title: songTitle }) };
  }, [text, songTitle, linesPerSlide]);

  const slideCount = result.song.parts.reduce((total, part) => total + Math.max(1, part.slides.length), 0);
  const fileTitle = songTitle.trim() || result.song.title;

  function download() {
    triggerBrowserDownload(new Blob([result.text], { type: "text/plain;charset=utf-8" }), songTextFileName(fileTitle));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="workspace-content-light max-w-2xl">
        <DialogTitle className="text-xl font-semibold">Export this song</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-[var(--text-secondary)]">
          Ready for FreeShow: each part has its name once, and a blank line starts each new slide. Your words are not changed.
        </DialogDescription>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">Lines on each slide</legend>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Lines on each slide">
            {SLIDE_SIZES.map((size) => (
              <button
                key={size.value}
                type="button"
                role="radio"
                aria-checked={linesPerSlide === size.value}
                onClick={() => setLinesPerSlide(size.value)}
                className={`pressable inline-flex min-h-11 items-center px-4 text-sm font-semibold ${linesPerSlide === size.value ? "ui-btn-primary" : "ui-btn-secondary"}`}
              >
                {size.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Slides are split evenly, so a slide is never left with one lonely line.</p>
        </fieldset>

        <p role="status" className="mt-4 text-sm text-[var(--text-secondary)]">
          {result.song.parts.length} {result.song.parts.length === 1 ? "part" : "parts"}, {slideCount} {slideCount === 1 ? "slide" : "slides"}
          {result.song.parts.some((part) => part.slides.length === 0) ? ". Parts with no words become an empty slide." : "."}
        </p>

        {result.warnings.length > 0 ? (
          <div role="alert" className="mt-3 border-l-2 border-[var(--state-warning)] pl-3 text-sm">
            <p className="font-semibold">Please check</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
            </ul>
          </div>
        ) : null}

        <label className="mt-4 block">
          <span className="text-sm font-semibold">What FreeShow will read</span>
          <textarea
            readOnly
            value={result.text}
            className="mt-2 block h-56 w-full resize-none rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] p-3 font-mono text-sm text-[var(--text-primary)]"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={BUTTON_PRIMARY} onClick={download}><Download aria-hidden="true" className="h-4 w-4" />Download for FreeShow</button>
          <button type="button" className={BUTTON_SECONDARY} onClick={() => void copy()}>
            {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <ClipboardCopy aria-hidden="true" className="h-4 w-4" />}
            {copied ? "Copied" : "Copy the text"}
          </button>
        </div>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          In FreeShow, choose File &gt; Import (Ctrl or Cmd + I) and pick the downloaded file. Or copy the text, then press Ctrl or Cmd + Alt + I to import it straight from the clipboard.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rule-default)] pt-4">
          <p className="text-sm text-[var(--text-secondary)]">Need a Word document instead?</p>
          <button type="button" className={BUTTON_SECONDARY} onClick={onWord} disabled={wordPending}>
            {wordPending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <FileText aria-hidden="true" className="h-4 w-4" />}
            {wordPending ? "Exporting…" : "Download Word document"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

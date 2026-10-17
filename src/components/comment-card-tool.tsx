"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, CircleAlert, ClipboardPaste, Download, Eraser, Expand, Loader2, Minimize2, Pencil, Scan, UserRound } from "lucide-react";
import { apiFetch, triggerBrowserDownload, type CommentCardNameTemplateRecord } from "@/lib/api-client";
import {
  COMMENT_CARD_EMPTY_DRAFT,
  commentCardDraftKey,
  readCommentCardDraft,
  resolveCommentCardInitialDraft,
  writeCommentCardDraft,
  type CommentCardDraft,
} from "@/lib/comment-card-draft";
import {
  COMMENT_CARD_PRESETS,
  COMMENT_CARD_BASE_HEIGHT,
  COMMENT_CARD_BASE_WIDTH,
  COMMENT_CARD_BUBBLE_PADDING_X,
  COMMENT_CARD_PREVIEW_CONTENT_WIDTH,
  COMMENT_CARD_PREVIEW_FRAME_WIDTH,
  COMMENT_CARD_PREVIEW_PADDING_X,
  COMMENT_CARD_TEXT_WIDTH,
  COMMENT_CARD_FIT_OPTIONS,
  COMMENT_CARD_FONT_FAMILY,
  COMMENT_CARD_TEXT_SAFE_INSET,
  calculateCommentCardFit,
  calculateCommentCardFrame,
  calculateCommentContentY,
  resolveCommentCardFit,
  resolveCommentFontSize,
  paginateCommentLines,
  addCommentCardPartSuffix,
  calculateSenderFontSize,
  calculateCommentLineCapacities,
  normalizeCommentCardFilename,
  parseCommentFontSizeInput,
  parseCommentLineSpacingInput,
  calculateCommentLineHeight,
  commentCardPreviewFontSize,
} from "@/lib/comment-card";
import { ProductionSelect } from "@/components/ui/production-select";
import { parseCopiedComment } from "@/lib/comment-card-clipboard";

type ToastTone = "info" | "success" | "error";
type CommentCardToolProps = { showToast: (message: string, tone?: ToastTone) => void; workspaceSlug: string };
type Session = { authenticated: boolean; user: { id: string; role: string | null } | null };
const FIT_ICONS = { contain: Minimize2, fill: Scan, stretch: Expand } as const;
const FIT_LABELS = { contain: "Contain", fill: "Fill", stretch: "Stretch" } as const;

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      if (lines.length) lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      if (context.measureText(word).width > maxWidth) {
        if (line) { lines.push(line); line = ""; }
        let segment = "";
        for (const character of Array.from(word)) {
          const candidate = segment + character;
          if (segment && context.measureText(candidate).width > maxWidth) {
            lines.push(segment);
            segment = character;
          } else segment = candidate;
        }
        line = segment;
        continue;
      }
      const candidate = line ? `${line} ${word}` : word;
      if (!line || context.measureText(candidate).width <= maxWidth) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function fitTextToWidth(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (context.measureText(text).width <= maxWidth) return text;
  const characters = Array.from(text);
  while (characters.length && context.measureText(`${characters.join("")}…`).width > maxWidth) characters.pop();
  return `${characters.join("")}…`;
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Comment card export failed.")), "image/png");
  });
}

function renderCommentCardPage(name: string, comment: string, width: number, height: number, fitValue: string, fontSizeValue: number, lineSpacing: number, showSender: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable in this browser.");

  const fit = resolveCommentCardFit(fitValue);
  const transform = calculateCommentCardFit(width, height, fit);
  const frame = calculateCommentCardFrame(width, height);
  context.shadowColor = "rgba(15, 23, 42, 0.42)";
  context.shadowBlur = Math.round(Math.min(width, height) * 0.065);
  context.shadowOffsetY = Math.round(Math.min(width, height) * 0.024);
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.roundRect(frame.x, frame.y, frame.width, frame.height, Math.round(Math.min(width, height) * 0.035));
  context.fill();
  context.shadowColor = "transparent";
  context.save();
  context.translate(transform.offsetX, fit === "contain" ? frame.y : transform.offsetY);
  context.scale(transform.scaleX, transform.scaleY);

  const templateWidth = COMMENT_CARD_BASE_WIDTH;
  const templateHeight = COMMENT_CARD_BASE_HEIGHT;
  const shortestSide = Math.min(templateWidth, templateHeight);
  const outerPadding = Math.round(shortestSide * 0.08);
  const bubbleX = outerPadding;
  const bubblePaddingX = COMMENT_CARD_BUBBLE_PADDING_X;
  const bubblePaddingY = Math.round(shortestSide * 0.045);
  const senderSize = calculateSenderFontSize(fontSizeValue);
  const safeWidth = COMMENT_CARD_PREVIEW_CONTENT_WIDTH;
  const maxTextWidth = COMMENT_CARD_TEXT_WIDTH;
  const commentSize = resolveCommentFontSize(fontSizeValue);
  context.font = `400 ${commentSize}px ${COMMENT_CARD_FONT_FAMILY}`;
  const lines = wrapText(context, comment, maxTextWidth);
  const lineHeight = calculateCommentLineHeight(commentSize, lineSpacing);

  const groupY = calculateCommentContentY(templateHeight);
  const bubbleY = groupY;

  const safeX = bubbleX + bubblePaddingX;
  const safeY = bubbleY + bubblePaddingY;
  const safeBottom = templateHeight - outerPadding - bubblePaddingY;
  context.beginPath();
  context.rect(safeX, safeY, safeWidth, Math.max(0, safeBottom - safeY));
  context.clip();
  const textX = safeX + COMMENT_CARD_TEXT_SAFE_INSET;
  let textY = safeY + COMMENT_CARD_TEXT_SAFE_INSET;
  context.textAlign = "left";
  context.textBaseline = "top";
  if (showSender) {
    context.fillStyle = "#101828";
    context.font = `800 ${senderSize}px ${COMMENT_CARD_FONT_FAMILY}`;
    context.fillText(fitTextToWidth(context, name.trim() || "Name", maxTextWidth), textX, textY);
    textY += Math.round(senderSize * 1.25 + shortestSide * 0.02);
  }
  context.font = `400 ${commentSize}px ${COMMENT_CARD_FONT_FAMILY}`;
  context.fillStyle = "#1d2939";
  for (const line of lines) {
    context.fillText(line, textX, textY);
    textY += lineHeight;
  }
  context.restore();
  return canvas;
}

function splitCommentIntoPages(comment: string, fontSizeValue: number, lineSpacing: number, showSender: boolean) {
  const measurementCanvas = document.createElement("canvas");
  const context = measurementCanvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable in this browser.");
  const fontSize = resolveCommentFontSize(fontSizeValue);
  context.font = `400 ${fontSize}px ${COMMENT_CARD_FONT_FAMILY}`;
  const lines = wrapText(context, comment, COMMENT_CARD_TEXT_WIDTH);
  const capacity = calculateCommentLineCapacities(fontSize, showSender, lineSpacing);
  return paginateCommentLines(lines, capacity.firstPage, capacity.continuation).map((pageLines) => pageLines.join("\n"));
}

function renderCommentCards(name: string, comment: string, width: number, height: number, fitValue: string, fontSizeValue: number, lineSpacing: number, showSender: boolean) {
  return splitCommentIntoPages(comment, fontSizeValue, lineSpacing, showSender).map((pageComment, index) =>
    renderCommentCardPage(name, pageComment, width, height, fitValue, fontSizeValue, lineSpacing, showSender && index === 0),
  );
}

export default function CommentCardTool({ showToast, workspaceSlug }: CommentCardToolProps) {
  const [name, setName] = useState(COMMENT_CARD_EMPTY_DRAFT.name);
  const [comment, setComment] = useState(COMMENT_CARD_EMPTY_DRAFT.comment);
  const [presetId, setPresetId] = useState<string>(COMMENT_CARD_EMPTY_DRAFT.presetId);
  const [filename, setFilename] = useState(COMMENT_CARD_EMPTY_DRAFT.filename);
  const [filenameDraft, setFilenameDraft] = useState("");
  const [editingFilename, setEditingFilename] = useState(false);
  const [fit, setFit] = useState<string>(COMMENT_CARD_EMPTY_DRAFT.fit);
  const [fontSize, setFontSize] = useState(COMMENT_CARD_EMPTY_DRAFT.fontSize);
  const [fontSizeInput, setFontSizeInput] = useState(String(COMMENT_CARD_EMPTY_DRAFT.fontSize));
  const [lineSpacing, setLineSpacing] = useState(COMMENT_CARD_EMPTY_DRAFT.lineSpacing);
  const [lineSpacingInput, setLineSpacingInput] = useState(String(COMMENT_CARD_EMPTY_DRAFT.lineSpacing));
  const [showSender, setShowSender] = useState(COMMENT_CARD_EMPTY_DRAFT.showSender);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [pastePending, setPastePending] = useState(false);
  const session = useQuery({
    queryKey: ["auth", "session", workspaceSlug],
    queryFn: () => apiFetch<Session>(`/api/auth/session?workspaceSlug=${encodeURIComponent(workspaceSlug)}`),
    enabled: Boolean(workspaceSlug),
  });
  const draftKey = workspaceSlug && session.data?.authenticated && session.data.user?.role
    ? commentCardDraftKey(session.data.user.id, workspaceSlug) : null;
  const nameTemplates = useQuery({
    queryKey: ["settings", "comment-card-name-templates", workspaceSlug],
    queryFn: () => apiFetch<CommentCardNameTemplateRecord[]>("/api/settings/comment-card-name-templates"),
    enabled: Boolean(draftKey),
    refetchOnMount: "always",
  });
  const activeDefaultName = nameTemplates.data?.find((template) => template.isActive)?.name ?? null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState<{ key: string; signature: string } | null>(null);
  const [storageError, setStorageError] = useState(false);
  const draft = useMemo<CommentCardDraft>(() => ({ name, comment, presetId: presetId as CommentCardDraft["presetId"], filename,
    fit: fit as CommentCardDraft["fit"], fontSize, lineSpacing, showSender }), [name, comment, presetId, filename, fit, fontSize, lineSpacing, showSender]);
  const draftSignature = JSON.stringify(draft);
  const latestDraft = useRef(draft);
  const saveStatus = !draftKey
    ? session.isPending ? "Checking draft recovery…" : "Device recovery unavailable for this session"
    : storageError ? "Draft could not be saved on this device"
      : loadedKey !== draftKey ? "Checking draft recovery…"
        : editingFilename && filenameDraft !== filename ? "Name not applied yet"
          : fontSizeInput !== String(fontSize) ? "Size not applied yet"
          : lineSpacingInput !== String(lineSpacing) ? "Line spacing not applied yet"
          : savedVersion?.key === draftKey && savedVersion.signature === draftSignature ? "Saved on this device" : "Saving changes…";
  const saveState = saveStatus === "Saved on this device" ? "saved"
    : storageError || (!draftKey && !session.isPending) ? "unavailable" : "pending";
  const preset = COMMENT_CARD_PRESETS.find((item) => item.id === presetId) ?? COMMENT_CARD_PRESETS[0];
  const canExport = Boolean(comment.trim() && (!showSender || name.trim()));
  const previewPages = useMemo(() => {
    if (typeof document === "undefined" || !comment.trim()) return [""];
    return splitCommentIntoPages(comment, fontSize, lineSpacing, showSender);
  }, [comment, fontSize, lineSpacing, showSender]);
  const textSafeAreaStyle = {
    paddingInline: `${(COMMENT_CARD_TEXT_SAFE_INSET / COMMENT_CARD_PREVIEW_CONTENT_WIDTH) * 100}%`,
    paddingBlock: `${(COMMENT_CARD_TEXT_SAFE_INSET / COMMENT_CARD_BASE_HEIGHT) * 100}%`,
  };
  const previewCardStyle = {
    containerType: "inline-size" as const,
    paddingInline: `${(COMMENT_CARD_PREVIEW_PADDING_X / COMMENT_CARD_PREVIEW_FRAME_WIDTH) * 100}%`,
    fontFamily: COMMENT_CARD_FONT_FAMILY,
  };
  const filenameInputRef = useRef<HTMLInputElement>(null);
  const renameFilenameButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { latestDraft.current = draft; }, [draft]);

  useEffect(() => {
    if (!draftKey || nameTemplates.isPending || nameTemplates.isFetching || loadedKey === draftKey) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = resolveCommentCardInitialDraft(readCommentCardDraft(window.localStorage, draftKey), activeDefaultName);
        setName(saved.name);
        setComment(saved.comment);
        setPresetId(saved.presetId);
        setFilename(saved.filename);
        setFit(saved.fit);
        setFontSize(saved.fontSize);
        setFontSizeInput(String(saved.fontSize));
        setLineSpacing(saved.lineSpacing);
        setLineSpacingInput(String(saved.lineSpacing));
        setShowSender(saved.showSender);
        setEditingFilename(false);
        setLoadedKey(draftKey);
        setSavedVersion(null);
        setStorageError(false);
      } catch {
        setLoadedKey(null);
        setStorageError(true);
      }
    });
    return () => { cancelled = true; };
  }, [draftKey, nameTemplates.isPending, nameTemplates.isFetching, activeDefaultName, loadedKey]);

  useEffect(() => {
    if (!draftKey || loadedKey !== draftKey) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        writeCommentCardDraft(window.localStorage, draftKey, draft);
        setSavedVersion({ key: draftKey, signature: draftSignature });
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    });
    return () => { cancelled = true; };
  }, [draftKey, loadedKey, draftSignature, draft]);

  useEffect(() => {
    if (!draftKey || loadedKey !== draftKey) return;
    const onHide = () => {
      try { writeCommentCardDraft(window.localStorage, draftKey, latestDraft.current); } catch { /* Save status reports storage failures. */ }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [draftKey, loadedKey]);

  useEffect(() => {
    if (editingFilename) {
      filenameInputRef.current?.focus();
      filenameInputRef.current?.select();
    }
  }, [editingFilename]);

  function finishFilenameRename() {
    setFilename(filenameDraft);
    setEditingFilename(false);
  }

  async function createBlobs() {
    if (!canExport) throw new Error("Enter the comment and a sender when the sender is shown.");
    return Promise.all(renderCommentCards(name.trim(), comment.trim(), preset.width, preset.height, fit, fontSize, lineSpacing, showSender).map(canvasToBlob));
  }

  async function download() {
    try {
      const blobs = await createBlobs();
      const baseName = normalizeCommentCardFilename(filename);
      blobs.forEach((blob, index) => triggerBrowserDownload(blob, blobs.length === 1 ? baseName : addCommentCardPartSuffix(baseName, index + 1)));
      showToast(`${blobs.length} comment card${blobs.length === 1 ? "" : "s"} downloaded.`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Comment card export failed.", "error");
    }
  }

  async function pasteFacebookComment() {
    if (!navigator.clipboard?.readText) {
      showToast("Clipboard paste is unavailable in this browser.", "error");
      return;
    }
    setPastePending(true);
    try {
      const copied = parseCopiedComment(await navigator.clipboard.readText());
      if (!copied) {
        showToast("Copy the commenter name and comment together, then try Paste FB again.", "error");
        return;
      }
      setName(copied.name);
      setComment(copied.comment);
      setShowSender(true);
      showToast("Comment pasted. Check the name and text before downloading.", "success");
    } catch {
      showToast("Could not read the clipboard. Allow paste access and try again.", "error");
    } finally {
      setPastePending(false);
    }
  }

  function clearCommentCard() {
    setName("");
    setComment("");
    showToast("Comment card cleared.", "success");
  }

  return (
    <section className="space-y-4">
      <section className="ui-surface-panel overflow-hidden shadow-[var(--workspace-elevation-floating)]" aria-label="Comment card controls">
        <header className="flex min-w-0 flex-wrap items-center gap-3 border-b border-[var(--border-default)] px-4 py-3">
          <div className="flex min-w-[10rem] flex-1 items-center gap-2">
            {editingFilename ? (
              <input
                ref={filenameInputRef}
                aria-label="Download filename"
                value={filenameDraft}
                onChange={(event) => setFilenameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === "Enter") {
                    event.preventDefault();
                    finishFilenameRename();
                    requestAnimationFrame(() => renameFilenameButtonRef.current?.focus());
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setEditingFilename(false);
                    requestAnimationFrame(() => renameFilenameButtonRef.current?.focus());
                  }
                }}
                maxLength={72}
                spellCheck={false}
                className="comment-card-filename-text comment-card-filename-input min-w-0 max-w-xl px-0 py-1 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                placeholder="comment-card"
              />
            ) : (
              <h1 className="comment-card-filename-text min-w-0 max-w-xl truncate text-[var(--text-primary)]" title={filename || "comment-card"}>{filename || "comment-card"}</h1>
            )}
            <button
              ref={renameFilenameButtonRef}
              type="button"
              className="pressable-subtle inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:bg-[var(--action-ghost-hover)] hover:text-[var(--text-accent)]"
              aria-label={editingFilename ? "Finish renaming" : "Rename comment card"}
              title={editingFilename ? "Finish renaming" : "Rename comment card"}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (editingFilename) finishFilenameRename();
                else {
                  setFilenameDraft(filename);
                  setEditingFilename(true);
                }
              }}
            >
              {editingFilename ? <Check className="h-4 w-4" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}
            </button>
            <span
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ${saveState === "saved" ? "text-[var(--state-success)]" : saveState === "unavailable" ? "text-[var(--state-danger)]" : "text-[var(--text-muted)]"}`}
              role="status"
              tabIndex={0}
              title={saveStatus}
              aria-label={saveStatus}
              data-save-state={saveState}
            >
              {saveState === "unavailable" ? <CircleAlert className="h-5 w-5" aria-hidden="true" /> : saveState === "pending" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11.5V12a8 8 0 1 1-4.7-7.3" /><path d="m8 11.5 3 3L20 5" /></svg>}
              <span className="sr-only">{saveStatus}</span>
            </span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={clearCommentCard}
              disabled={pastePending || (!name && !comment)}
              aria-label="Clear sender and comment"
              title="Clear sender and comment"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-transparent bg-transparent text-[var(--text-primary)] transition-colors hover:border-[var(--action-primary-bg)] hover:bg-transparent hover:text-[var(--action-primary-bg)] active:border-[var(--action-primary-bg)] active:bg-[var(--action-primary-bg)] active:text-[var(--action-primary-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-transparent disabled:hover:text-[var(--text-primary)]"
            ><Eraser className="h-5 w-5" aria-hidden="true" /></button>
            <button
              type="button"
              onClick={() => void pasteFacebookComment()}
              disabled={pastePending}
              aria-label="Paste FB Comment"
              title="Paste FB Comment"
              data-paste-state={pastePending ? "pending" : "idle"}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ${pastePending ? "border-[var(--action-primary-bg)] bg-[var(--action-primary-bg)] text-[var(--action-primary-ink)]" : "border-transparent bg-transparent text-[var(--text-primary)] hover:border-[var(--action-primary-bg)] hover:bg-transparent hover:text-[var(--action-primary-bg)] active:border-[var(--action-primary-bg)] active:bg-[var(--action-primary-bg)] active:text-[var(--action-primary-ink)]"}`}
            >{pastePending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ClipboardPaste className="h-5 w-5" aria-hidden="true" />}</button>
            <button type="button" onClick={() => void download()} disabled={!canExport} className="pressable ui-btn-primary inline-flex shrink-0 items-center gap-2 px-3 text-sm font-semibold disabled:opacity-50 sm:px-4"><Download className="h-4 w-4" aria-hidden="true" />Download PNG</button>
          </div>
        </header>

        <button type="button" className="flex min-h-11 w-full items-center justify-between border-b border-[var(--border-default)] px-4 text-sm font-semibold text-[var(--text-primary)] min-[600px]:hidden" aria-controls="comment-card-options" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((open) => !open)}>
          Card options <span aria-hidden="true">{optionsOpen ? "−" : "+"}</span>
        </button>
        <div id="comment-card-options" data-open={optionsOpen} className="ui-register-toolbar comment-card-toolbar" role="group" aria-label="Comment card options">
          <div className="flex flex-col gap-1">
            <label className="technical-label" htmlFor="comment-card-font-size">Font size</label>
            <input
              id="comment-card-font-size"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="Comment font size, 18 to 300"
              title="Comment font size, 18 to 300"
              value={fontSizeInput}
              onChange={(event) => {
                const value = event.target.value;
                if (!/^\d{0,3}$/.test(value)) return;
                setFontSizeInput(value);
                const size = parseCommentFontSizeInput(value);
                if (size !== null) setFontSize(size);
              }}
              onBlur={() => setFontSizeInput(String(fontSize))}
              className="ui-field h-10 w-[4.5rem] px-2 text-center text-sm tabular-nums"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="technical-label" htmlFor="comment-card-line-spacing">Line gap</label>
            <input
              id="comment-card-line-spacing"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="Line spacing in pixels, 0 to 200"
              title="Line spacing in pixels, 0 to 200"
              value={lineSpacingInput}
              onChange={(event) => {
                const value = event.target.value;
                if (!/^\d{0,3}$/.test(value)) return;
                setLineSpacingInput(value);
                const spacing = parseCommentLineSpacingInput(value);
                if (spacing !== null) setLineSpacing(spacing);
              }}
              onBlur={() => setLineSpacingInput(String(lineSpacing))}
              className="ui-field h-10 w-[4.5rem] px-2 text-center text-sm tabular-nums"
            />
          </div>
          <button
            type="button"
            aria-label="Show sender"
            aria-pressed={showSender}
            title={showSender ? "Hide sender" : "Show sender"}
            onClick={() => setShowSender((visible) => !visible)}
            className={`pressable-subtle inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ${showSender ? "bg-[var(--action-primary-bg)] text-[var(--action-primary-ink)] hover:bg-[var(--action-primary-bg-hover)]" : "bg-transparent text-[var(--text-primary)] hover:bg-[var(--action-ghost-hover)]"}`}
          ><UserRound className="h-5 w-5" aria-hidden="true" /></button>
          <div className="flex flex-col gap-1">
            <span className="technical-label" id="comment-card-fit-label">Fit</span>
            <div className="flex items-center gap-1" role="group" aria-label="Fit mode">
              {COMMENT_CARD_FIT_OPTIONS.map((item) => {
                const FitIcon = FIT_ICONS[item];
                return <button
                  key={item}
                  type="button"
                  aria-label={FIT_LABELS[item]}
                  aria-pressed={fit === item}
                  title={FIT_LABELS[item]}
                  onClick={() => setFit(item)}
                  className={`pressable-subtle inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ${fit === item ? "bg-[var(--action-primary-bg)] text-[var(--action-primary-ink)]" : "bg-transparent text-[var(--text-primary)] hover:bg-[var(--action-ghost-hover)]"}`}
                ><FitIcon className="h-5 w-5" aria-hidden="true" /></button>;
              })}
            </div>
          </div>

          <ProductionSelect label="Output size" ariaLabel="Comment card output size" value={presetId} onValueChange={setPresetId} options={COMMENT_CARD_PRESETS.map((item) => ({ value: item.id, label: item.label }))} className="w-56 max-w-full" triggerClassName="text-xs tracking-tight" />
        </div>
      </section>

      <section className="space-y-6" aria-label="Comment card preview">
        <div className="flex min-h-0 items-center justify-center py-2 min-[1200px]:min-h-[520px] min-[1200px]:py-5">
          <div className="flex w-full max-w-4xl items-center bg-transparent p-1 min-[600px]:p-[4%]" style={{ aspectRatio: `${preset.width} / ${preset.height}` }}>
            <div className="flex h-full w-full items-center">
              <div className="h-full min-w-0 flex-1 overflow-hidden rounded-[clamp(1rem,3vw,2.5rem)] bg-white py-[4%] text-[#1d2939] shadow-[0_24px_64px_rgba(15,23,42,0.42),0_5px_18px_rgba(15,23,42,0.20)]" style={previewCardStyle}>
                <div className="flex h-full min-h-0 flex-col overflow-hidden" style={textSafeAreaStyle}>
                  {showSender ? (
                    <input
                      aria-label="Sender name on card"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={120}
                      placeholder="Commenter name"
                      className="comment-card-editor-field w-full shrink-0 p-0 font-extrabold leading-tight tracking-[-0.01em] text-[#101828] placeholder:text-[#98a2b3]"
                      style={{ fontSize: commentCardPreviewFontSize(calculateSenderFontSize(fontSize)) }}
                    />
                  ) : null}
                  <textarea
                    aria-label="Comment text on card"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    maxLength={10000}
                    placeholder="Type or paste the comment here"
                    className={`${showSender ? "mt-[2%]" : ""} comment-card-editor-field min-h-0 w-full flex-1 resize-none overflow-auto p-0 text-[#1d2939] placeholder:text-[#98a2b3]`}
                    style={{ fontSize: commentCardPreviewFontSize(fontSize), lineHeight: commentCardPreviewFontSize(calculateCommentLineHeight(fontSize, lineSpacing)) }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {comment.trim() ? (
          <section className="border-t border-[var(--border-default)] pt-5" aria-labelledby="comment-card-pages-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 id="comment-card-pages-heading" className="text-sm font-semibold text-[var(--text-primary)]">Export pages</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">These are the separate PNG files that will be downloaded.</p>
              </div>
              <span className="font-[var(--font-mono)] text-xs font-semibold text-[var(--text-secondary)]">{previewPages.length} {previewPages.length === 1 ? "page" : "pages"}</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {previewPages.map((pageComment, index) => (
                <article key={`${index}-${pageComment.slice(0, 24)}`} className="min-w-0">
                  <p className="mb-2 font-[var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Page {index + 1}</p>
                  <div className="flex w-full items-center bg-transparent p-[4%]" style={{ aspectRatio: `${preset.width} / ${preset.height}` }}>
                    <div className="h-full min-w-0 flex-1 overflow-hidden rounded-[clamp(0.75rem,2vw,2rem)] bg-white py-[4%] text-[#1d2939] shadow-[0_18px_48px_rgba(15,23,42,0.38),0_4px_14px_rgba(15,23,42,0.18)]" style={previewCardStyle}>
                      <div className="flex h-full min-h-0 flex-col overflow-hidden" style={textSafeAreaStyle}>
                        {showSender && index === 0 ? <p className="shrink-0 font-extrabold leading-tight tracking-[-0.01em] text-[#101828]" style={{ fontSize: commentCardPreviewFontSize(calculateSenderFontSize(fontSize)) }}>{name.trim() || "Commenter name"}</p> : null}
                        <p className={`${showSender && index === 0 ? "mt-[2%]" : ""} whitespace-pre-wrap break-words`} style={{ fontSize: commentCardPreviewFontSize(fontSize), lineHeight: commentCardPreviewFontSize(calculateCommentLineHeight(fontSize, lineSpacing)) }}>{pageComment}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

      </section>
    </section>
  );
}

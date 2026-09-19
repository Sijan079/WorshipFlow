"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ContextMenu, Popover } from "radix-ui";
import { ArrowDown, ArrowUp, Check, ChevronRight, CircleAlert, ClipboardCopy, ClipboardPaste, Copy, Download, Info, Keyboard, List, Loader2, Menu, Merge, Pencil, Plus, Redo2, Scissors, Tag, Trash2, Undo2, WandSparkles, X, type LucideIcon } from "lucide-react";
import { EditorState, TextSelection, type Command, type SelectionBookmark } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { baseKeymap, splitBlock } from "prosemirror-commands";
import { redo, redoDepth, undo, undoDepth } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { ProductionSelect } from "@/components/ui/production-select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { SongTagPresetRecord } from "@/lib/api-client";
import type { normalizeExtractorWarnings } from "@/lib/extractor-warnings";
import { activeSection, copyActiveSection, documentFromText, documentToText, getSections, groupSections, pasteSection, sectionCommand, sectionIdentityPlugin, sectionPosition, shortcutFallbackSelection, tagSelection, type SectionAction, type SectionSnapshot, type SongSection } from "./document";
import { songHistory, structuralTransaction } from "./editor-history";
import { clipboardSection, copiedText, plainTextSlice, sectionClipboardText } from "./clipboard";
import { pageLayoutPlugin, requestShortcutActivationScroll, requestShortcutCaretScroll } from "./page-layout-plugin";
import { PAGE_GAP, PAGE_HEIGHT, PAGE_WIDTH, pageColumns, pageOrigin } from "./pagination";
import styles from "./song-document-editor.module.css";
import { draftSaveState } from "./save-status";
import { shortcutKey, shortcutLabel } from "./shortcuts";
import { shortcutTargetPlugin, shortcutTargetTransaction } from "./shortcut-target-plugin";

type Props = {
  text: string; songTitle: string; tags: SongTagPresetRecord[]; recoveryStatus: string;
  warnings: ReturnType<typeof normalizeExtractorWarnings>; warningsDismissed: boolean;
  onChange: (text: string) => void; onTitleChange: (title: string) => void;
  onDismissWarnings: () => void; onClear: () => void; onExport: () => void; onReformat: () => void;
  exportPending: boolean; aiPending: boolean; aiUsed: boolean; settingsHref: string;
  readOnly?: boolean;
};
const actions: { action: SectionAction; label: string; icon: LucideIcon }[] = [
  { action: "insert", label: "Insert section after", icon: Plus },
  { action: "split", label: "Split section", icon: Scissors },
  { action: "merge", label: "Merge with previous section", icon: Merge },
  { action: "duplicate", label: "Duplicate section", icon: Copy },
  { action: "up", label: "Move section up", icon: ArrowUp },
  { action: "down", label: "Move section down", icon: ArrowDown },
  { action: "delete", label: "Delete section", icon: Trash2 },
];
const subscribePlatform = () => () => {};
const isMacPlatform = () => /Mac|iPhone|iPad/.test(navigator.platform);

export default function SongDocumentEditor(props: Props) {
  const region = useRef<HTMLElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const outlineList = useRef<HTMLDivElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const renameButton = useRef<HTMLButtonElement>(null);
  const cancelClear = useRef<HTMLButtonElement>(null);
  const tagList = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const shortcutMode = useRef(false);
  const tagPickerOpenRef = useRef(false);
  const sectionClipboard = useRef<SectionSnapshot | null>(null);
  const clipboardNoticeTimer = useRef<number | null>(null);
  const rememberedSelection = useRef<SelectionBookmark | null>(null);
  const hasUserSelection = useRef(false);
  const latest = useRef(props);
  const lastEmitted = useRef(props.text);
  const [sections, setSections] = useState<SongSection[]>([]);
  const [current, setCurrent] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [available, setAvailable] = useState<SectionAction[]>([]);
  const [pages, setPages] = useState(1);
  const [outline, setOutline] = useState(false);
  const [contextMenu, setContextMenu] = useState(true);
  const [shortcutPending, setShortcutPending] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [clipboardNotice, setClipboardNotice] = useState<{ message: string; tone: "success" | "warning" } | null>(null);
  const mac = useSyncExternalStore(subscribePlatform, isMacPlatform, () => false);
  const [mobile, setMobile] = useState(false);
  const [preview, setPreview] = useState(false);
  const [zoom, setZoom] = useState("100");
  const [viewportWidth, setViewportWidth] = useState(0);
  const [groupSize, setGroupSize] = useState<"2" | "3">("2");
  const [clearOpen, setClearOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const saveStatus = props.aiPending ? "Reformatting lyrics…"
    : editingTitle && titleDraft !== props.songTitle ? "Name not applied yet" : props.recoveryStatus;
  const saveState = draftSaveState(saveStatus);
  const continuous = mobile && !preview;
  const readOnly = (mobile && preview) || props.aiPending || Boolean(props.readOnly);
  const columns = pageColumns(Number(zoom), viewportWidth, pages, mobile);
  const currentTag = sections[current]?.tag ?? "";
  const tagOptions = props.tags.map(tag => ({ value: tag.token, label: tag.label }));
  if (!tagOptions.some(tag => tag.value === currentTag)) tagOptions.unshift({ value: currentTag, label: currentTag || "Untagged" });

  useEffect(() => { latest.current = props; });
  useEffect(() => {
    if (editingTitle) { titleInput.current?.focus(); titleInput.current?.select(); }
  }, [editingTitle]);
  const finishRename = () => {
    if (!readOnly) props.onTitleChange(titleDraft);
    setEditingTitle(false);
  };
  const updateTagPicker = useCallback((open: boolean) => {
    tagPickerOpenRef.current = open;
    setTagPickerOpen(open);
  }, []);
  const showClipboardNotice = useCallback((message: string, tone: "success" | "warning" = "success") => {
    if (clipboardNoticeTimer.current !== null) window.clearTimeout(clipboardNoticeTimer.current);
    setClipboardNotice({ message, tone });
    clipboardNoticeTimer.current = window.setTimeout(() => {
      clipboardNoticeTimer.current = null;
      setClipboardNotice(null);
    }, 2_500);
  }, []);
  const copyCurrentSection = useCallback(() => {
    const editor = view.current;
    if (!editor?.editable) return;
    const snapshot = copyActiveSection(editor.state);
    sectionClipboard.current = snapshot;
    showClipboardNotice("Section copied.");
    if (!navigator.clipboard?.writeText) {
      showClipboardNotice("Section copied in this editor; system clipboard is unavailable.", "warning");
      return;
    }
    void navigator.clipboard.writeText(sectionClipboardText(snapshot)).catch(() => {
      showClipboardNotice("Section copied in this editor; system clipboard is unavailable.", "warning");
    });
  }, [showClipboardNotice]);
  const pasteCurrentSection = useCallback(async () => {
    let snapshot = sectionClipboard.current;
    if (!snapshot) {
      if (!navigator.clipboard?.readText) {
        showClipboardNotice("System clipboard access is unavailable.", "warning");
        return;
      }
      try {
        snapshot = clipboardSection(await navigator.clipboard.readText());
      } catch {
        showClipboardNotice("System clipboard access was denied.", "warning");
        return;
      }
      if (!snapshot) {
        showClipboardNotice("Clipboard does not contain one valid song section.", "warning");
        return;
      }
    }
    const editor = view.current;
    if (!editor?.editable) return;
    pasteSection(snapshot)(editor.state, editor.dispatch, editor);
    editor.focus();
    showClipboardNotice("Section pasted.");
  }, [showClipboardNotice]);
  useEffect(() => () => {
    if (clipboardNoticeTimer.current !== null) window.clearTimeout(clipboardNoticeTimer.current);
  }, []);
  useEffect(() => {
    const list = outlineList.current;
    const selected = list?.querySelector("[aria-current='true']");
    if (!list || !selected) return;
    const bounds = list.getBoundingClientRect();
    const row = selected.getBoundingClientRect();
    if (row.bottom > bounds.bottom) list.scrollTop += row.bottom - bounds.bottom;
    else if (row.top < bounds.top) list.scrollTop += row.top - bounds.top;
  }, [current, outline, sections]);
  useEffect(() => {
    const element = region.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY);
        element.style.setProperty("--editor-top", `${top}px`);
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element.parentElement ?? element);
    window.addEventListener("resize", measure);
    document.addEventListener("animationend", measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("animationend", measure);
    };
  }, []);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setViewportWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mount.current) return;
    const updateControls = (state: EditorState, changed = true) => {
      if (changed) setSections(getSections(state.doc));
      setCurrent(activeSection(state));
      setCanUndo(undoDepth(state) > 0);
      setCanRedo(redoDepth(state) > 0);
      setAvailable(actions.filter(item => sectionCommand(item.action)(state)).map(item => item.action));
    };
    const editor = new EditorView(mount.current, {
      state: EditorState.create({
        doc: documentFromText(latest.current.text),
        plugins: [...songHistory(), sectionIdentityPlugin(), shortcutTargetPlugin(), keymap({ "Mod-z": undo, "Mod-y": redo, "Mod-Shift-z": redo,
          "Shift-Enter": splitBlock, "Mod-Alt-ArrowUp": sectionCommand("up"), "Mod-Alt-ArrowDown": sectionCommand("down"),
        }), keymap(baseKeymap), pageLayoutPlugin(setPages)],
      }),
      attributes: { role: "textbox", "aria-label": "Song lyrics document", "aria-multiline": "true", spellcheck: "true", autocapitalize: "sentences" },
      handleKeyDown: (editor, event) => !editor.editable && (
        ["Enter", "Backspace", "Delete"].includes(event.key)
        || ((event.ctrlKey || event.metaKey) && (["z", "y"].includes(event.key.toLowerCase()) || event.altKey))
      ),
      dispatchTransaction(tr) {
        if (rememberedSelection.current) rememberedSelection.current = rememberedSelection.current.map(tr.mapping);
        const next = editor.state.apply(tr);
        editor.updateState(next);
        if (tr.selectionSet && shortcutMode.current) requestShortcutCaretScroll(editor);
        if (editor.hasFocus()) {
          hasUserSelection.current = true;
          rememberedSelection.current = next.selection.getBookmark();
        }
        if (tr.docChanged || tr.selectionSet) updateControls(next, tr.docChanged);
        if (tr.docChanged) {
          lastEmitted.current = documentToText(next.doc);
          latest.current.onChange(lastEmitted.current);
        }
      },
      // Paste plain text only; arbitrary HTML and formatting never enter the song schema.
      clipboardTextParser: plainTextSlice,
      handlePaste(editor, event) {
        if (!editor.editable) return true;
        const text = event.clipboardData?.getData("text/plain");
        if (text === undefined) return false;
        editor.dispatch(editor.state.tr.replaceSelection(plainTextSlice(text)).scrollIntoView());
        return true;
      },
      clipboardTextSerializer: copiedText,
      handleDOMEvents: {
        focus: editor => {
          hasUserSelection.current = true;
          rememberedSelection.current = editor.state.selection.getBookmark();
          return false;
        },
        drop: (_editor, event) => { event.preventDefault(); return true; },
        contextmenu: (editor, event) => {
          const point = editor.posAtCoords({ left: event.clientX, top: event.clientY });
          if (point && (editor.state.selection.empty || point.pos < editor.state.selection.from || point.pos > editor.state.selection.to)) {
            editor.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(point.pos))));
          }
          return false;
        },
      },
    });
    const setMode = (active: boolean) => {
      if (shortcutMode.current === active) return;
      shortcutMode.current = active;
      setShortcutPending(active);
      editor.dispatch(shortcutTargetTransaction(editor.state.tr, active));
      if (!active) updateTagPicker(false);
    };
    const restoreTarget = () => {
      let selection = null;
      if (hasUserSelection.current && rememberedSelection.current) {
        try { selection = rememberedSelection.current.resolve(editor.state.doc); }
        catch { rememberedSelection.current = null; }
      }
      selection ??= shortcutFallbackSelection(editor.state.doc);
      editor.dispatch(editor.state.tr.setSelection(selection));
      editor.focus();
      hasUserSelection.current = true;
      rememberedSelection.current = editor.state.selection.getBookmark();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (shortcutMode.current) requestShortcutActivationScroll(editor);
      }));
    };
    const onKey = (event: KeyboardEvent) => {
      if (!editor.editable || event.isComposing) { setMode(false); return; }
      const target = event.target as HTMLElement | null;
      const toggleKey = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k";
      if (tagPickerOpenRef.current && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        updateTagPicker(false);
        requestAnimationFrame(() => editor.focus());
        return;
      }
      if (target?.closest("[role='dialog'], [role='menu']")) return;
      const outsideEditorInput = !editor.dom.contains(target) && Boolean(target?.closest("input, textarea, select, [contenteditable='true']"));
      if (outsideEditorInput && !toggleKey && event.key !== "Escape") return;
      const wasActive = shortcutMode.current;
      const result = shortcutKey(shortcutMode.current, event.key, {
        primary: event.ctrlKey || event.metaKey, alt: event.altKey, shift: event.shiftKey, repeat: event.repeat,
      });
      const sectionMove = result.action === "up" || result.action === "down";
      if (sectionMove && (!editor.hasFocus() || !editor.dom.contains(target))) return;
      setMode(result.active);
      if (!result.handled) return;
      if (!editor.dom.contains(target) && !result.action && event.key !== "Escape" && !toggleKey) return;
      event.preventDefault(); event.stopPropagation();
      if (result.active && !wasActive) restoreTarget();
      if (result.action === "tags") updateTagPicker(true);
      else if (result.action === "copy") copyCurrentSection();
      else if (result.action === "paste") void pasteCurrentSection();
      else if (result.action) sectionCommand(result.action)(editor.state, editor.dispatch, editor);
    };
    document.addEventListener("keydown", onKey, true);
    view.current = editor;
    updateControls(editor.state);
    return () => { document.removeEventListener("keydown", onKey, true); editor.destroy(); view.current = null; };
  }, [copyCurrentSection, pasteCurrentSection, updateTagPicker]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || props.text === lastEmitted.current) return;
    lastEmitted.current = props.text;
    const doc = documentFromText(props.text);
    editor.dispatch(structuralTransaction(editor.state.tr.replaceWith(0, editor.state.doc.content.size, doc.content)));
  }, [props.text]);
  useEffect(() => {
    const editor = view.current;
    editor?.setProps({ editable: () => !readOnly });
    if (!readOnly) return;
    shortcutMode.current = false;
    if (editor) editor.dispatch(shortcutTargetTransaction(editor.state.tr, false));
    const frame = requestAnimationFrame(() => { setShortcutPending(false); updateTagPicker(false); });
    return () => cancelAnimationFrame(frame);
  }, [readOnly, updateTagPicker]);

  const run = (command: Command) => {
    const editor = view.current;
    if (!editor || readOnly) return;
    command(editor.state, editor.dispatch, editor);
    editor.focus();
  };
  const jump = (index: number) => {
    const editor = view.current;
    if (!editor) return;
    editor.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, sectionPosition(editor.state.doc, index) + 2)).scrollIntoView());
    editor.focus();
    if (mobile) setOutline(false);
  };
  const exitShortcutMode = () => {
    shortcutMode.current = false;
    setShortcutPending(false);
    updateTagPicker(false);
    const editor = view.current;
    if (!editor) return;
    editor.dispatch(shortcutTargetTransaction(editor.state.tr, false));
    editor.focus();
  };

  const content = (
    <div ref={viewport} className={styles.viewport} data-song-viewport>
      <div className={styles.document} style={continuous ? undefined : { width: columns * PAGE_WIDTH + (columns - 1) * PAGE_GAP, height: Math.ceil(pages / columns) * (PAGE_HEIGHT + PAGE_GAP) - PAGE_GAP, zoom: Number(zoom) / 100 }}>
        {!continuous ? Array.from({ length: pages }, (_, index) => <div key={index} className={styles.paper} style={pageOrigin(index, columns)} aria-hidden="true"><span>{index + 1}</span></div>) : null}
        <div ref={mount} />
      </div>
    </div>
  );

  return (
    <section ref={region} className={styles.editor} data-continuous={continuous} data-page-columns={columns} data-outline-open={outline} data-shortcut-mode={shortcutPending} aria-label="Song Editor">
      <div className={`ui-surface-elevated ui-operational-register ${styles.controls}`}>
      <header className={styles.header}>
        <div className={styles.title}>
          {editingTitle ? <input ref={titleInput} id="song-document-title" className={styles.titleInput} aria-label="Export file name" value={titleDraft} onChange={event => setTitleDraft(event.target.value)} placeholder="Untitled song" maxLength={500}
            onBlur={finishRename} onKeyDown={event => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter") { event.preventDefault(); finishRename(); requestAnimationFrame(() => renameButton.current?.focus()); }
              if (event.key === "Escape") { event.preventDefault(); setEditingTitle(false); requestAnimationFrame(() => renameButton.current?.focus()); }
            }} /> : <span className={styles.titleText} data-document-title title={props.songTitle || "Untitled song"}>{props.songTitle || "Untitled song"}</span>}
          <button ref={renameButton} disabled={readOnly} type="button" className={styles.tool} aria-label={editingTitle ? "Finish renaming" : "Rename document"} title={editingTitle ? "Finish renaming" : "Rename document"}
            onMouseDown={event => event.preventDefault()} onClick={() => {
              if (editingTitle) finishRename();
              else { setTitleDraft(props.songTitle); setEditingTitle(true); }
            }}>{editingTitle ? <Check aria-hidden="true" /> : <Pencil aria-hidden="true" />}</button>
          <span className={styles.saveStatus} role="status" tabIndex={0} title={saveStatus} aria-label={saveStatus} data-save-state={saveState}>
            {saveState === "unavailable" ? <CircleAlert aria-hidden="true" /> : saveState === "pending" ? <Loader2 aria-hidden="true" /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11.5V12a8 8 0 1 1-4.7-7.3" /><path d="m8 11.5 3 3L20 5" /></svg>}
            <span className="sr-only">{saveStatus}</span>
          </span>
        </div>
        <button type="button" className="ui-btn-primary inline-flex items-center gap-2 px-4 text-sm font-semibold" onClick={props.onExport} disabled={props.exportPending || props.aiPending || !props.text.trim()}>
          {props.exportPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{props.exportPending ? "Exporting…" : "Export DOCX"}
        </button>
      </header>
      <div className={`ui-register-toolbar ${styles.toolbar}`} role="group" aria-label="Document controls">
        <div className={styles.controlGroup} role="group" aria-label="History and outline">
        <button type="button" className={styles.tool} onClick={() => setOutline(!outline)} aria-pressed={outline} aria-label="Toggle section outline" title="Section outline"><List /></button>
        <button type="button" className={styles.tool} onClick={() => run(undo)} disabled={!canUndo || readOnly} aria-label="Undo" title="Undo (Ctrl/Cmd+Z)"><Undo2 /></button>
        <button type="button" className={styles.tool} onClick={() => run(redo)} disabled={!canRedo || readOnly} aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)"><Redo2 /></button>
        </div>
        <div className={styles.ribbonGroup} role="group" aria-label="Sections">
        <div className={styles.controlGroup}>
        <ProductionSelect ariaLabel="Section tag" value={currentTag} options={tagOptions} onValueChange={tag => run(tagSelection(tag))} disabled={readOnly} className="w-36" />
        <div className={styles.sectionIcons}>
          {actions.map(({ action, label, icon: Icon }) => <button key={action} type="button" className={`${styles.tool} ${action === "delete" ? styles.deleteTool : ""}`} aria-label={label} title={`${label} (${shortcutLabel(action, mac)})`} disabled={readOnly || !available.includes(action)} onClick={() => run(sectionCommand(action))}><Icon aria-hidden="true" /></button>)}
          <button type="button" className={styles.tool} aria-label="Copy section" title={`Copy section (${shortcutLabel("copy", mac)})`} disabled={readOnly} onClick={copyCurrentSection}><ClipboardCopy aria-hidden="true" /></button>
          <button type="button" className={styles.tool} aria-label="Paste section after" title={`Paste section after (${shortcutLabel("paste", mac)})`} disabled={readOnly} onClick={() => void pasteCurrentSection()}><ClipboardPaste aria-hidden="true" /></button>
        </div>
        </div>
        <span className={styles.ribbonLabel}>Sections</span>
        </div>
        <div className={styles.ribbonGroup} role="group" aria-label="Groupings">
        <div className={styles.controlGroup}>
        <ProductionSelect ariaLabel="Lines per slide" value={groupSize} onValueChange={setGroupSize} options={[{ value: "2", label: "2 lines / slide" }, { value: "3", label: "3 lines / slide" }]} className="w-36" disabled={readOnly} />
        <button type="button" className={styles.tool} disabled={!currentTag || readOnly} onClick={() => run(groupSections(currentTag, Number(groupSize) as 2 | 3))} title={`Regroup all ${currentTag || "selected tag"} sections`}>Apply grouping</button>
        </div>
        <span className={styles.ribbonLabel}>Groupings</span>
        </div>
        <div className={styles.viewControls}>
          <span className="text-xs text-[var(--text-secondary)]">{continuous ? "Continuous view" : `${pages} ${pages === 1 ? "page" : "pages"}`}</span>
          {!continuous ? <ProductionSelect ariaLabel="Document zoom" value={zoom} onValueChange={setZoom} options={[{ value: "50", label: "50%" }, { value: "75", label: "75%" }, { value: "100", label: "100%" }, { value: "125", label: "125%" }]} className="w-24" /> : null}
          <details className={styles.info}>
            <summary aria-label="Document information" title="Document information"><Info aria-hidden="true" /></summary>
            <div>Letter · Arial 11<p>Page breaks are approximate; Word may paginate the DOCX differently.</p></div>
          </details>
          <button type="button" className={`${styles.tool} ${styles.mobilePreview}`} onClick={() => setPreview(!preview)} aria-pressed={preview}>{preview ? "Edit lyrics" : "Page preview"}</button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" className={styles.tool} aria-label="More editor options" title="More editor options"><Menu /></button></DropdownMenuTrigger>
            <DropdownMenuContent className={`workspace-content-light ui-action-menu-content min-w-64 ${styles.optionsMenu}`} align="end">
              <DropdownMenuItem className={styles.optionsItem} disabled={readOnly || props.aiUsed || props.aiPending || props.exportPending} onSelect={props.onReformat}><WandSparkles />{props.aiPending ? "Reformatting…" : props.aiUsed ? "AI reformat used" : "Reformat with AI"}</DropdownMenuItem>
              <DropdownMenuItem className={styles.optionsItem} asChild><Link href={props.settingsHref}>Manage song tags</Link></DropdownMenuItem>
              <DropdownMenuCheckboxItem className={styles.optionsItem} checked={contextMenu} onCheckedChange={setContextMenu}>Song actions on right-click</DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={styles.optionsItem} variant="destructive" disabled={readOnly || props.aiPending || props.exportPending} onSelect={() => setClearOpen(true)}><Trash2 />Clear draft</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      </div>
      {!props.warningsDismissed && props.warnings.length > 0 ? <section aria-label="Formatter warnings" className={styles.warnings}>
        <div className="flex items-center justify-between gap-2"><strong>Review the formatted lyrics</strong><button type="button" className="ui-modal-close" aria-label="Dismiss formatter warnings" onClick={props.onDismissWarnings}><X className="h-4 w-4" /></button></div>
        <ul>{props.warnings.map(warning => <li key={warning.code}><strong>{warning.title}:</strong> {warning.message}</li>)}</ul>
      </section> : null}
      <div className={styles.body}>
        {outline ? <nav className={styles.outline} aria-label="Song sections">
          <p className={styles.outlineHeading}>Sections · {sections.length}</p>
          <div ref={outlineList} className={styles.outlineList}>
          {sections.map((section, index) => <button type="button" key={section.id} aria-current={index === current} onClick={() => jump(index)}><span>{index + 1}. {section.tag || "Untagged"}</span><small>{section.lines.find(line => line.trim()) || "Empty section"}</small></button>)}
          </div>
          <div className={styles.outlineActions}>
            <button type="button" aria-label="Move selected section up" disabled={!available.includes("up") || readOnly} onClick={() => run(sectionCommand("up"))}><ArrowUp className="h-4 w-4" /></button>
            <button type="button" aria-label="Move selected section down" disabled={!available.includes("down") || readOnly} onClick={() => run(sectionCommand("down"))}><ArrowDown className="h-4 w-4" /></button>
          </div>
        </nav> : null}
        <div className={styles.viewerPane}>
        {shortcutPending || clipboardNotice ? <div className={styles.shortcutModeLayer} data-shortcut-overlay>
          {shortcutPending ?
          <Popover.Root open={tagPickerOpen && !readOnly} onOpenChange={open => {
            updateTagPicker(open);
            if (!open) requestAnimationFrame(() => view.current?.focus());
          }}>
            <Popover.Anchor asChild>
              <div className={styles.shortcutMode} role="status" aria-live="polite">
                <span className={styles.shortcutModeTitle}><Keyboard aria-hidden="true" /><strong>Section shortcuts active</strong></span>
                {clipboardNotice
                  ? <span className={styles.shortcutFeedback} data-tone={clipboardNotice.tone}>{clipboardNotice.message}</span>
                  : <span className={styles.shortcutModeKeys} aria-label={`I insert, S split, M merge, D duplicate, C copy, V paste, arrow keys move the caret, ${mac ? "Option" : "Alt"} plus arrow keys move the section, X delete, T tags`}><kbd>I</kbd> Insert · <kbd>S</kbd> Split · <kbd>M</kbd> Merge · <kbd>D</kbd> Duplicate · <kbd>C</kbd> Copy · <kbd>V</kbd> Paste · <kbd>↑</kbd><kbd>↓</kbd> Caret · <kbd>{mac ? "⌥" : "Alt"}</kbd>+<kbd>↑</kbd><kbd>↓</kbd> Section · <kbd>X</kbd> Delete · <kbd>T</kbd> Tags</span>}
                <span className={styles.shortcutModeExit}><kbd>Esc</kbd><span>to exit</span><button type="button" aria-label="Exit section shortcut mode" title="Exit shortcut mode (Esc)" onClick={exitShortcutMode}><X aria-hidden="true" /></button></span>
              </div>
            </Popover.Anchor>
            <Popover.Portal>
              <Popover.Content className={`workspace-content-light ${styles.tagPopover}`} side="bottom" align="center" sideOffset={8}
                role="menu" aria-label="Tag section" collisionPadding={12}
                onOpenAutoFocus={event => {
                  event.preventDefault();
                  requestAnimationFrame(() => {
                    const selected = tagList.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
                      ?? tagList.current?.querySelector<HTMLButtonElement>("button");
                    selected?.focus();
                  });
                }}
                onCloseAutoFocus={event => event.preventDefault()}>
                <div ref={tagList} className={styles.tagList} onKeyDown={event => {
                  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                  const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
                  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                  const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
                    : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
                  event.preventDefault(); buttons[next]?.focus();
                }}>
                  {props.tags.map(tag => <button key={tag.id} type="button" role="menuitemradio" aria-checked={tag.token === currentTag}
                    className={styles.tagOption} onClick={() => { run(tagSelection(tag.token)); updateTagPicker(false); }}>
                    <Check className={styles.tagOptionCheck} data-visible={tag.token === currentTag} aria-hidden="true" /><span>{tag.label}</span>
                  </button>)}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          : clipboardNotice ? <div className={styles.shortcutNotice} data-tone={clipboardNotice.tone} role="status" aria-live="polite">{clipboardNotice.message}</div> : null}
        </div> : null}
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild disabled={!contextMenu || readOnly}>
            {content}
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Content className={`workspace-content-light ${styles.menu}`} onCloseAutoFocus={event => event.preventDefault()}>
              <ContextMenu.Sub>
                <ContextMenu.SubTrigger className={styles.menuItem}><Tag className="h-4 w-4" />Tag section<kbd className={styles.shortcut}>{shortcutLabel("tags", mac)}</kbd><ChevronRight className="h-4 w-4" /></ContextMenu.SubTrigger>
                <ContextMenu.Portal><ContextMenu.SubContent className={`workspace-content-light ${styles.menu}`} sideOffset={4}>
                  {props.tags.map(tag => <ContextMenu.Item key={tag.id} className={styles.menuItem} onSelect={() => run(tagSelection(tag.token))}><Tag className="h-4 w-4" />{tag.label}</ContextMenu.Item>)}
                </ContextMenu.SubContent></ContextMenu.Portal>
              </ContextMenu.Sub>
              <ContextMenu.Separator className="my-1 border-t border-[var(--border-default)]" />
              <ContextMenu.Item className={styles.menuItem} disabled={readOnly} onSelect={copyCurrentSection}><ClipboardCopy className="h-4 w-4" />Copy section<kbd className={styles.shortcut}>{shortcutLabel("copy", mac)}</kbd></ContextMenu.Item>
              <ContextMenu.Item className={styles.menuItem} disabled={readOnly} onSelect={() => void pasteCurrentSection()}><ClipboardPaste className="h-4 w-4" />Paste section after<kbd className={styles.shortcut}>{shortcutLabel("paste", mac)}</kbd></ContextMenu.Item>
              <ContextMenu.Separator className="my-1 border-t border-[var(--border-default)]" />
              {actions.map(({ action, label, icon: Icon }) => <ContextMenu.Item key={action} className={styles.menuItem} data-destructive={action === "delete" || undefined} disabled={!available.includes(action) || readOnly} onSelect={() => run(sectionCommand(action))}><Icon className="h-4 w-4" />{label}<kbd className={styles.shortcut}>{shortcutLabel(action, mac)}</kbd></ContextMenu.Item>)}
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>
        </div>
      </div>
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent className="workspace-content-light" onOpenAutoFocus={event => { event.preventDefault(); cancelClear.current?.focus(); }}>
          <DialogTitle>Clear this song draft?</DialogTitle><DialogDescription>This marks the conversion Done, deletes its temporary draft across your devices, and returns to song selection. Export a DOCX first if you want to keep it.</DialogDescription>
          <div className="mt-4 flex justify-end gap-2"><button ref={cancelClear} type="button" className="ui-btn-cancel px-4 py-2" onClick={() => setClearOpen(false)}>Cancel</button><button type="button" className="ui-btn-danger px-4 py-2" disabled={readOnly || props.aiPending || props.exportPending} onClick={() => { setClearOpen(false); props.onClear(); }}>Clear draft</button></div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

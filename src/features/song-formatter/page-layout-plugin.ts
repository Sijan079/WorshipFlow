import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import { paginateGroups, pageOrigin, PAGE_MARGIN, type MeasuredGroup } from "./pagination";
import { activeSection, sectionPosition } from "./document";
import { selectionScrollDelta, type SelectionScrollMode } from "./scrolling";

const layoutKey = new PluginKey<DecorationSet>("song-pages");
const scrollRequests = new WeakMap<EditorView, (mode: SelectionScrollMode) => void>();

export function requestShortcutActivationScroll(view: EditorView) {
  scrollRequests.get(view)?.("activation");
}

export function requestShortcutCaretScroll(view: EditorView) {
  scrollRequests.get(view)?.("minimal");
}

export function pageLayoutPlugin(onPages: (count: number) => void) {
  let requestSelectionScroll: ((mode: SelectionScrollMode) => void) | undefined;
  return new Plugin<DecorationSet>({
    key: layoutKey,
    state: {
      init: () => DecorationSet.empty,
      apply: (tr, decorations) => tr.getMeta(layoutKey) ?? decorations.map(tr.mapping, tr.doc),
    },
    props: {
      decorations: state => {
        const index = activeSection(state);
        const pos = sectionPosition(state.doc, index);
        return (layoutKey.getState(state) ?? DecorationSet.empty).add(state.doc, [
          Decoration.node(pos, pos + state.doc.child(index).nodeSize, { "data-active-song-section": "true" }),
        ]);
      },
      // New paragraphs lose their old layout decoration when split. Defer
      // scrolling until they have their measured page position, never (0, 0).
      handleScrollToSelection: () => { requestSelectionScroll?.("minimal"); return true; },
    },
    view: view => {
      let frame = 0, scrollFrame = 0, pendingScroll: SelectionScrollMode | false = false, disposed = false, signature = "";
      const finishScroll = () => {
        if (!pendingScroll) return;
        cancelAnimationFrame(scrollFrame);
        scrollFrame = requestAnimationFrame(() => {
          if (disposed || view.composing) return;
          const mode = pendingScroll;
          if (!mode) return;
          pendingScroll = false;
          const viewport = view.dom.closest<HTMLElement>("[data-song-viewport]");
          if (!viewport) return;
          const caret = view.coordsAtPos(view.state.selection.head);
          const sectionPos = sectionPosition(view.state.doc, activeSection(view.state));
          const heading = view.state.selection.head === sectionPos + 2
            ? (view.nodeDOM(sectionPos) as HTMLElement | null)?.querySelector(".song-tag-heading")?.getBoundingClientRect()
            : undefined;
          const targetTop = Math.min(caret.top, heading?.top ?? caret.top);
          const bounds = viewport.getBoundingClientRect();
          const inset = 24;
          const overlay = viewport.parentElement?.querySelector<HTMLElement>("[data-shortcut-overlay]");
          const topInset = Math.max(inset, (overlay?.getBoundingClientRect().bottom ?? bounds.top) - bounds.top + 12);
          const delta = selectionScrollDelta({ caret, targetTop, bounds, topInset, mode });
          if (!delta.top && !delta.left) return;
          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          viewport.scrollTo({
            top: viewport.scrollTop + delta.top,
            left: viewport.scrollLeft + delta.left,
            behavior: mode === "activation" && !reducedMotion ? "smooth" : "auto",
          });
        });
      };
      const measure = () => {
        frame = 0;
        if (disposed || view.composing) { if (!disposed) schedule(); return; }
        const host = view.dom.closest("[data-page-columns]");
        const continuous = host?.getAttribute("data-continuous") === "true";
        const columns = Number(host?.getAttribute("data-page-columns")) || 1;
        const groups: MeasuredGroup[] = [];
        const nodes = new Map<number, { pos: number; size: number; heading: number; sectionPos: number; sectionSize: number }>();
        if (!continuous) view.state.doc.forEach((section, sectionPos) => {
          const element = view.nodeDOM(sectionPos) as HTMLElement | null;
          const headingHeight = element?.querySelector(".song-tag-heading")?.getBoundingClientRect().height ?? 24;
          // CSS zoom scales DOM rectangles, but the layout model uses CSS pixels.
          const scale = (view.dom.getBoundingClientRect().width / view.dom.offsetWidth) || 1;
          let group: MeasuredGroup = { positions: [], heights: [] };
          section.forEach((line, offset, index) => {
            const pos = sectionPos + 1 + offset;
            const lineElement = view.nodeDOM(pos) as HTMLElement | null;
            const height = (lineElement?.getBoundingClientRect().height ?? 20 * scale) / scale;
            group.positions.push(index === 0 ? sectionPos : pos);
            group.heights.push(height + (index === 0 ? headingHeight / scale : 0));
            nodes.set(index === 0 ? sectionPos : pos, { pos, size: line.nodeSize, heading: index === 0 ? headingHeight / scale : 0, sectionPos, sectionSize: section.nodeSize });
            if (!line.textContent.trim()) { groups.push(group); group = { positions: [], heights: [] }; }
          });
          if (group.positions.length) groups.push(group);
        });
        const layout = paginateGroups(groups);
        const next = JSON.stringify({ layout, columns, continuous, nodes: [...nodes.values()] });
        if (next === signature) { finishScroll(); return; }
        signature = next;
        const decorations: Decoration[] = [];
        for (const placement of layout.placements) {
          const node = nodes.get(placement.pos)!;
          const origin = pageOrigin(placement.page, columns);
          const left = origin.left + PAGE_MARGIN;
          const top = origin.top + placement.top;
          decorations.push(Decoration.node(node.pos, node.pos + node.size, {
            style: `position:absolute;left:${left}px;top:${top + node.heading}px`,
            "data-song-page": String(placement.page + 1),
          }));
          if (node.heading) decorations.push(Decoration.node(node.sectionPos, node.sectionPos + node.sectionSize, {
            style: `--song-heading-left:${left}px;--song-heading-top:${top}px`,
          }));
        }
        view.dispatch(view.state.tr.setMeta(layoutKey, DecorationSet.create(view.state.doc, decorations)).setMeta("addToHistory", false));
        onPages(layout.pages);
        finishScroll();
      };
      const schedule = () => { if (!frame && !disposed) frame = requestAnimationFrame(measure); };
      requestSelectionScroll = mode => {
        if (!pendingScroll || mode === "activation") pendingScroll = mode;
        schedule();
      };
      scrollRequests.set(view, requestSelectionScroll);
      const observer = new ResizeObserver(schedule);
      observer.observe(view.dom);
      const host = view.dom.closest("[data-page-columns]");
      const attributes = new MutationObserver(schedule);
      if (host) attributes.observe(host, { attributes: true, attributeFilter: ["data-continuous", "data-page-columns"] });
      view.dom.addEventListener("compositionend", schedule);
      schedule();
      return {
        update: (nextView: EditorView, previous) => {
          if (nextView.state.doc !== previous.doc) {
            // Whole-section replacement can discard mapped decorations even
            // when all positions and measured heights happen to be identical.
            signature = "";
            schedule();
          }
        },
        destroy: () => {
          disposed = true;
          cancelAnimationFrame(frame);
          cancelAnimationFrame(scrollFrame);
          requestSelectionScroll = undefined;
          scrollRequests.delete(view);
          observer.disconnect();
          attributes.disconnect();
          view.dom.removeEventListener("compositionend", schedule);
        },
      };
    },
  });
}

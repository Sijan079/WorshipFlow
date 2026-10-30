"use client";

import type { ReactNode } from "react";
import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "@/features/people/field-styles";
import type { SiteBlockInput } from "../blocks/block-validation";
import type { EditorBlock } from "./editor-state";
import ImageField from "./image-field";
import LinkField from "./link-field";
import ColumnsFields from "./columns-fields";
import CoverFields from "./cover-fields";
import SectionFields from "./section-fields";

export const BLOCK_LABELS: Record<SiteBlockInput["type"], string> = {
  PARAGRAPH: "Text",
  HEADING: "Heading",
  LIST: "List",
  QUOTE: "Quote",
  IMAGE: "Picture",
  BUTTON: "Button",
  SPACER: "Space",
  SERVICE_TIMES: "Service times",
  ANNOUNCEMENTS_LIST: "Announcements",
  EVENTS_LIST: "Upcoming events",
  CONTACT: "Contact details",
  SECTION: "Section",
  COVER: "Cover",
  COLUMNS: "Columns",
};

type Props = {
  block: EditorBlock;
  pages: Array<{ slug: string; title: string }>;
  disabled: boolean;
  // Columns can change how many columns they have; the editor keeps that rule (see editor-state).
  onSetColumns?: (count: number) => void;
  // Typing passes coalesce so a run of keystrokes is one undo step; choosing an option does not.
  onChange: (content: EditorBlock["content"], coalesce?: boolean) => void;
};

function Choice<T extends string>({ label, value, options, disabled, onChange }: { label: string; value: T; options: Array<[T, string]>; disabled: boolean; onChange: (value: T) => void }) {
  return (
    <label className="block">
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      <select className={TEXT_FIELD_CLASS} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as T)}>
        {options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}
      </select>
    </label>
  );
}

const ALIGN_OPTIONS: Array<["left" | "center", string]> = [["left", "Left"], ["center", "Centre"]];

function Note({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[var(--text-muted)]">{children}</p>;
}

export default function BlockBody({ block, pages, disabled, onChange, onSetColumns }: Props) {
  switch (block.type) {
    case "PARAGRAPH": {
      const c = block.content;
      return (
        <div className="space-y-3">
          <textarea
            aria-label="Text"
            rows={4}
            disabled={disabled}
            className={`${TEXT_FIELD_CLASS} ${c.size === "large" ? "text-xl" : ""} ${c.align === "center" ? "text-center" : ""}`}
            placeholder="Type your text here"
            value={c.runs.map((run) => run.text).join("")}
            onChange={(event) => onChange({ ...c, runs: [{ text: event.target.value }] }, true)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice label="Text size" value={c.size} disabled={disabled} options={[["normal", "Normal"], ["large", "Large"]]} onChange={(size) => onChange({ ...c, size })} />
            <Choice label="Align" value={c.align} disabled={disabled} options={ALIGN_OPTIONS} onChange={(align) => onChange({ ...c, align })} />
          </div>
        </div>
      );
    }
    case "HEADING": {
      const c = block.content;
      return (
        <div className="space-y-3">
          <input
            aria-label="Heading"
            disabled={disabled}
            className={`${TEXT_FIELD_CLASS} text-xl font-semibold ${c.align === "center" ? "text-center" : ""}`}
            placeholder="Heading"
            value={c.text}
            onChange={(event) => onChange({ ...c, text: event.target.value }, true)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice label="Size" value={String(c.level) as "2" | "3"} disabled={disabled} options={[["2", "Large"], ["3", "Smaller"]]} onChange={(level) => onChange({ ...c, level: level === "2" ? 2 : 3 })} />
            <Choice label="Align" value={c.align} disabled={disabled} options={ALIGN_OPTIONS} onChange={(align) => onChange({ ...c, align })} />
          </div>
        </div>
      );
    }
    case "LIST": {
      const c = block.content;
      return (
        <div className="space-y-3">
          <textarea
            aria-label="List items, one per line"
            rows={4}
            disabled={disabled}
            className={TEXT_FIELD_CLASS}
            placeholder="One item per line"
            value={c.items.join("\n")}
            onChange={(event) => onChange({ ...c, items: event.target.value.split("\n") }, true)}
          />
          <Choice label="Style" value={c.ordered ? "numbered" : "bullets"} disabled={disabled} options={[["bullets", "Bullets"], ["numbered", "Numbers"]]} onChange={(style) => onChange({ ...c, ordered: style === "numbered" })} />
        </div>
      );
    }
    case "QUOTE": {
      const c = block.content;
      return (
        <div className="space-y-3">
          <textarea aria-label="Quote" rows={3} disabled={disabled} className={TEXT_FIELD_CLASS} placeholder="The quote" value={c.text} onChange={(event) => onChange({ ...c, text: event.target.value }, true)} />
          <label className="block">
            <span className={FIELD_LABEL_CLASS}>Who said it (optional)</span>
            <input disabled={disabled} className={TEXT_FIELD_CLASS} value={c.cite ?? ""} onChange={(event) => onChange({ ...c, cite: event.target.value }, true)} />
          </label>
        </div>
      );
    }
    case "BUTTON": {
      const c = block.content;
      return (
        <div className="space-y-3">
          <label className="block">
            <span className={FIELD_LABEL_CLASS}>What the button says</span>
            <input disabled={disabled} className={TEXT_FIELD_CLASS} value={c.label} onChange={(event) => onChange({ ...c, label: event.target.value }, true)} />
          </label>
          <LinkField link={c.link} pages={pages} onChange={(link) => onChange({ ...c, link }, true)} />
          <Choice label="Align" value={c.align} disabled={disabled} options={ALIGN_OPTIONS} onChange={(align) => onChange({ ...c, align })} />
        </div>
      );
    }
    case "SPACER": {
      const c = block.content;
      return <Choice label="Height" value={c.size} disabled={disabled} options={[["small", "Small"], ["medium", "Medium"], ["large", "Large"]]} onChange={(size) => onChange({ ...c, size })} />;
    }
    case "SERVICE_TIMES": {
      const c = block.content;
      return (
        <label className="block">
          <span className={FIELD_LABEL_CLASS}>One service time per line, for example “Sunday 9:00 AM”</span>
          <textarea rows={3} disabled={disabled} className={TEXT_FIELD_CLASS} value={c.lines.join("\n")} onChange={(event) => onChange({ lines: event.target.value.split("\n") }, true)} />
        </label>
      );
    }
    case "ANNOUNCEMENTS_LIST":
      return <Note>Shows your published announcements that are switched on for the website. Manage them on the Announcements page.</Note>;
    case "EVENTS_LIST":
      return <Note>Shows your upcoming events that are switched on for the website. Manage them on the Events page.</Note>;
    case "CONTACT":
      return <Note>Shows your church address, phone and email. Set them under Website settings at the top of this page.</Note>;
    case "IMAGE":
      return <ImageField content={block.content} disabled={disabled} onChange={onChange} />;
    case "SECTION":
      return <SectionFields content={block.content} disabled={disabled} onChange={onChange} />;
    case "COVER":
      return <CoverFields content={block.content} pages={pages} disabled={disabled} onChange={onChange} />;
    case "COLUMNS":
      return <ColumnsFields content={block.content} disabled={disabled} onChange={onChange} onSetColumns={onSetColumns ?? (() => undefined)} />;
  }
}

"use client";

import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react";
import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "@/features/people/field-styles";
import { SITE_LIMITS, type CarouselBlockInput } from "../blocks/block-validation";
import { addSlide, moveSlide, removeSlide } from "../blocks/carousel-slides";
import LinkField from "./link-field";
import { usePictureUpload } from "./use-picture-upload";

type Content = CarouselBlockInput["content"];
type Slide = Content["slides"][number];
type Props = { content: Content; pages: Array<{ slug: string; title: string }>; disabled: boolean; onChange: (content: Content, coalesce?: boolean) => void };

const SECONDARY_BUTTON = "ui-btn-secondary pressable inline-flex items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60";
const ICON_BUTTON = "inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] disabled:opacity-40";

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

function SlidePicture({ slide, number, disabled, onChange }: { slide: Slide; number: number; disabled: boolean; onChange: (slide: Slide) => void }) {
  const { input, upload, hasPicture, shown, choose, open } = usePictureUpload(slide.picture ?? "", (picture) => onChange({ ...slide, picture }));
  return (
    <div className="space-y-3">
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview or the church's own small WebP
        <img src={shown} alt="" className="max-h-32 max-w-full rounded-lg" />
      ) : null}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Choose a picture for card ${number}`} disabled={disabled || upload.isPending} onChange={(event) => choose(event.target.files?.[0])} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={SECONDARY_BUTTON + " min-h-11"} disabled={disabled || upload.isPending} onClick={open}>
          <ImagePlus aria-hidden="true" className="h-4 w-4" />
          {upload.isPending ? "Adding your picture…" : hasPicture ? "Choose a different picture" : "Add a picture (optional)"}
        </button>
        {hasPicture ? <button type="button" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold underline" disabled={disabled} onClick={() => onChange({ ...slide, picture: undefined })}>Remove the picture</button> : null}
      </div>
      {upload.isError ? <p role="alert" className="border-l-2 border-[var(--state-danger)] pl-3 text-sm">{upload.error instanceof Error ? upload.error.message : "The picture could not be added."}</p> : null}
    </div>
  );
}

// A row of cards that scroll sideways. Each card has a title, and may have a line of words, a picture and a button.
export default function CarouselFields({ content, pages, disabled, onChange }: Props) {
  const setSlide = (index: number, slide: Slide, coalesce = false) => onChange({ ...content, slides: content.slides.map((item, i) => (i === index ? slide : item)) }, coalesce);
  const count = content.slides.length;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Choice label="Cards in view on a computer" value={String(content.perView) as "2" | "3" | "4"} disabled={disabled} options={[["2", "Two"], ["3", "Three"], ["4", "Four"]]} onChange={(value) => onChange({ ...content, perView: Number(value) as 2 | 3 | 4 })} />
        <Choice label="How wide" value={content.width} disabled={disabled} options={[["content", "Reading width"], ["wide", "Wide"], ["full", "Full width of the screen"]]} onChange={(width) => onChange({ ...content, width })} />
        <label className="block">
          <span className={FIELD_LABEL_CLASS}>Name for screen readers (optional)</span>
          <input disabled={disabled} className={TEXT_FIELD_CLASS} maxLength={80} placeholder="For example: Our ministries" value={content.label ?? ""} onChange={(event) => onChange({ ...content, label: event.target.value }, true)} />
        </label>
      </div>

      <ol className="space-y-4" aria-label="Cards in this carousel">
        {content.slides.map((slide, index) => (
          <li key={index} className="space-y-3 border-t border-[var(--rule-default)] pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Card {index + 1} of {count}</p>
              {!disabled ? (
                <div className="flex items-center">
                  <button type="button" className={ICON_BUTTON} aria-label={`Move card ${index + 1} earlier`} title="Move earlier" disabled={index === 0} onClick={() => onChange(moveSlide(content, index, "up"))}><ArrowUp aria-hidden="true" className="h-5 w-5" /></button>
                  <button type="button" className={ICON_BUTTON} aria-label={`Move card ${index + 1} later`} title="Move later" disabled={index === count - 1} onClick={() => onChange(moveSlide(content, index, "down"))}><ArrowDown aria-hidden="true" className="h-5 w-5" /></button>
                  <button type="button" className={ICON_BUTTON} aria-label={`Delete card ${index + 1}`} title={count <= 2 ? "A carousel needs at least two cards" : "Delete this card"} disabled={count <= 2} onClick={() => onChange(removeSlide(content, index))}><Trash2 aria-hidden="true" className="h-5 w-5" /></button>
                </div>
              ) : null}
            </div>
            <label className="block">
              <span className={FIELD_LABEL_CLASS}>Title</span>
              <input disabled={disabled} className={`${TEXT_FIELD_CLASS} font-semibold`} maxLength={60} placeholder="For example: Children" value={slide.title} onChange={(event) => setSlide(index, { ...slide, title: event.target.value }, true)} />
            </label>
            <label className="block">
              <span className={FIELD_LABEL_CLASS}>A line under the title (optional)</span>
              <textarea disabled={disabled} rows={2} className={TEXT_FIELD_CLASS} maxLength={200} value={slide.text ?? ""} onChange={(event) => setSlide(index, { ...slide, text: event.target.value }, true)} />
            </label>
            <SlidePicture slide={slide} number={index + 1} disabled={disabled} onChange={(next) => setSlide(index, next)} />
            {slide.button ? (
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <label className="block min-w-0 flex-1">
                    <span className={FIELD_LABEL_CLASS}>What the link says</span>
                    <input disabled={disabled} className={TEXT_FIELD_CLASS} maxLength={60} value={slide.button.label} onChange={(event) => setSlide(index, { ...slide, button: { ...slide.button!, label: event.target.value } }, true)} />
                  </label>
                  <button type="button" className={ICON_BUTTON} aria-label={`Remove the link on card ${index + 1}`} title="Remove this link" disabled={disabled} onClick={() => setSlide(index, { ...slide, button: undefined })}><Trash2 aria-hidden="true" className="h-5 w-5" /></button>
                </div>
                <LinkField link={slide.button.link} pages={pages} onChange={(link) => setSlide(index, { ...slide, button: { ...slide.button!, link } }, true)} />
              </div>
            ) : (
              <button
                type="button"
                className={SECONDARY_BUTTON + " min-h-11"}
                disabled={disabled}
                onClick={() => setSlide(index, { ...slide, button: { label: "Learn more", link: pages[0] ? { kind: "page", slug: pages[0].slug } : { kind: "url", url: "https://" } } })}
              >
                <Plus aria-hidden="true" className="h-4 w-4" />Add a link
              </button>
            )}
          </li>
        ))}
      </ol>

      <button type="button" className={SECONDARY_BUTTON + " min-h-11"} disabled={disabled || count >= SITE_LIMITS.carouselSlides} onClick={() => onChange(addSlide(content))}>
        <Plus aria-hidden="true" className="h-4 w-4" />{count >= SITE_LIMITS.carouselSlides ? `Most cards reached (${SITE_LIMITS.carouselSlides})` : "Add a card"}
      </button>
    </div>
  );
}

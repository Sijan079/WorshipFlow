"use client";

import { FIELD_LABEL_CLASS, TEXT_FIELD_CLASS } from "@/features/people/field-styles";
import type { SiteLink } from "../blocks/block-validation";

type LinkKind = "page" | "web" | "phone" | "email";

function kindOf(link: SiteLink): LinkKind {
  if (link.kind === "page") return "page";
  if (link.url.startsWith("tel:")) return "phone";
  if (link.url.startsWith("mailto:")) return "email";
  return "web";
}

function valueOf(link: SiteLink) {
  if (link.kind === "page") return link.slug;
  return link.url.replace(/^(tel:|mailto:)/, "");
}

function build(kind: LinkKind, value: string): SiteLink {
  if (kind === "page") return { kind: "page", slug: value };
  if (kind === "phone") return { kind: "url", url: `tel:${value}` };
  if (kind === "email") return { kind: "url", url: `mailto:${value}` };
  return { kind: "url", url: value };
}

const PLACEHOLDER: Record<Exclude<LinkKind, "page">, string> = {
  web: "https://example.org",
  phone: "+63 900 000 0000",
  email: "office@example.org",
};

// Where a button or link goes: another page of the site, a web address, a phone number or an email address.
// Nothing else can be chosen, so an unsafe link cannot be typed in by mistake.
export default function LinkField({ link, pages, onChange }: { link: SiteLink; pages: Array<{ slug: string; title: string }>; onChange: (link: SiteLink) => void }) {
  const kind = kindOf(link);
  return (
    <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <label>
        <span className={FIELD_LABEL_CLASS}>Goes to</span>
        <select
          className={TEXT_FIELD_CLASS}
          value={kind}
          onChange={(event) => {
            const next = event.target.value as LinkKind;
            onChange(build(next, next === "page" ? (pages[0]?.slug ?? "") : next === "web" ? "https://" : ""));
          }}
        >
          <option value="page">Another page</option>
          <option value="web">A web address</option>
          <option value="phone">A phone number</option>
          <option value="email">An email address</option>
        </select>
      </label>
      {kind === "page" ? (
        <label>
          <span className={FIELD_LABEL_CLASS}>Page</span>
          <select className={TEXT_FIELD_CLASS} value={valueOf(link)} onChange={(event) => onChange(build("page", event.target.value))}>
            {pages.map((page) => <option key={page.slug} value={page.slug}>{page.title}</option>)}
          </select>
        </label>
      ) : (
        <label>
          <span className={FIELD_LABEL_CLASS}>{kind === "web" ? "Web address" : kind === "phone" ? "Phone number" : "Email address"}</span>
          <input className={TEXT_FIELD_CLASS} value={valueOf(link)} placeholder={PLACEHOLDER[kind]} onChange={(event) => onChange(build(kind, event.target.value))} />
        </label>
      )}
    </div>
  );
}

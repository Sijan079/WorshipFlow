import type { PublicBlock, PublicSite } from "./public-site-data";
import type { SiteLink, TextRun } from "@/features/site/blocks/block-validation";
import "./public-site.css";

function when(startsAt: string, timezone: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "full", timeStyle: "short", timeZone: timezone }).format(new Date(startsAt));
}

function hrefOf(link: SiteLink, churchSlug: string) {
  return link.kind === "page" ? (link.slug === "home" ? `/c/${churchSlug}` : `/c/${churchSlug}/${link.slug}`) : link.url;
}

function isOutside(link: SiteLink) {
  return link.kind === "url" && /^https?:/i.test(link.url);
}

function Run({ run, churchSlug }: { run: TextRun; churchSlug: string }) {
  let node: React.ReactNode = run.text;
  if (run.bold) node = <strong>{node}</strong>;
  if (run.italic) node = <em>{node}</em>;
  if (run.link) {
    node = <a className="underline" href={hrefOf(run.link, churchSlug)} {...(isOutside(run.link) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{node}</a>;
  }
  return <>{node}</>;
}

const alignClass = { left: "text-left", center: "text-center" } as const;
const spacerClass = { small: "h-4", medium: "h-8", large: "h-16" } as const;

function Block({ block, churchSlug }: { block: PublicBlock; churchSlug: string }) {
  switch (block.type) {
    case "PARAGRAPH":
      return (
        <p className={`my-4 whitespace-pre-line leading-relaxed ${block.content.size === "large" ? "text-2xl" : "text-lg"} ${alignClass[block.content.align]}`}>
          {block.content.runs.map((run, index) => <Run key={index} run={run} churchSlug={churchSlug} />)}
        </p>
      );
    case "HEADING": {
      const Tag = block.content.level === 2 ? "h2" : "h3";
      return <Tag className={`mt-10 mb-3 font-semibold ${block.content.level === 2 ? "text-2xl" : "text-xl"} ${alignClass[block.content.align]}`}>{block.content.text}</Tag>;
    }
    case "LIST": {
      const Tag = block.content.ordered ? "ol" : "ul";
      return (
        <Tag className={`my-4 ml-6 space-y-1 text-lg ${block.content.ordered ? "list-decimal" : "list-disc"}`}>
          {block.content.items.filter((item) => item.trim() !== "").map((item, index) => <li key={index}>{item}</li>)}
        </Tag>
      );
    }
    case "IMAGE":
      return (
        <figure className={`my-6 ${block.align === "center" ? "text-center" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- already a small WebP made by the site's own upload */}
          <img src={block.src} alt={block.alt} width={block.width} height={block.height} loading="lazy" className={`h-auto max-w-full rounded-lg ${block.align === "center" ? "mx-auto" : ""}`} />
          {block.caption ? <figcaption className="mt-2 text-base text-[var(--site-muted)]">{block.caption}</figcaption> : null}
        </figure>
      );
    case "QUOTE":
      return (
        <blockquote className="my-6 border-l-4 border-[var(--site-line)] pl-5 text-xl italic">
          {block.content.text}
          {block.content.cite && <footer className="mt-2 text-base not-italic text-[var(--site-muted)]">{block.content.cite}</footer>}
        </blockquote>
      );
    case "BUTTON":
      return (
        <p className={`my-6 ${alignClass[block.content.align]}`}>
          <a
            className="inline-block rounded-lg bg-[var(--site-accent)] px-6 py-3 text-lg font-semibold text-[var(--site-accent-text)]"
            href={hrefOf(block.content.link, churchSlug)}
            {...(isOutside(block.content.link) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {block.content.label}
          </a>
        </p>
      );
    case "SPACER":
      return <div aria-hidden="true" className={spacerClass[block.content.size]} />;
    case "SERVICE_TIMES":
      return (
        <section className="my-6 rounded-lg bg-[var(--site-soft)] px-6 py-5">
          <h2 className="mb-2 text-2xl font-semibold">Service times</h2>
          {block.content.lines.filter((line) => line.trim() !== "").map((line, index) => <p key={index} className="text-lg">{line}</p>)}
        </section>
      );
    case "ANNOUNCEMENTS_LIST":
      return (
        <section className="my-6">
          <h2 className="mb-2 text-2xl font-semibold">Announcements</h2>
          {block.items.length === 0 && <p className="text-lg text-[var(--site-muted)]">Nothing new right now.</p>}
          {block.items.map((item) => (
            <article key={item.id} className="border-t border-[var(--site-line)] py-3">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              {item.body && <p className="whitespace-pre-line text-lg">{item.body}</p>}
            </article>
          ))}
        </section>
      );
    case "EVENTS_LIST":
      return (
        <section className="my-6">
          <h2 className="mb-2 text-2xl font-semibold">Upcoming events</h2>
          {block.items.length === 0 && <p className="text-lg text-[var(--site-muted)]">No events are planned yet.</p>}
          {block.items.map((item) => (
            <article key={item.id} className="border-t border-[var(--site-line)] py-3">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="text-base text-[var(--site-muted)]">{when(item.startsAt, item.timezone)}{item.venue ? ` · ${item.venue}` : ""}</p>
            </article>
          ))}
        </section>
      );
    case "CONTACT":
      if (!block.address && !block.email && !block.phone) return null;
      return (
        <section className="my-6">
          <h2 className="mb-2 text-2xl font-semibold">Contact</h2>
          {block.address && <p className="whitespace-pre-line text-lg">{block.address}</p>}
          {block.email && <p className="text-lg">{block.email}</p>}
          {block.phone && <p className="text-lg">{block.phone}</p>}
        </section>
      );
  }
}

export function PublicSiteView({ site, churchSlug }: { site: PublicSite; churchSlug: string }) {
  return (
    <div className="public-site min-h-screen">
      <header className="border-b border-[var(--site-line)] px-6 py-4 text-xl font-bold">{site.churchName}</header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-4xl font-bold leading-tight">{site.page.title}</h1>
        {site.page.blocks.map((block) => <Block key={block.id} block={block} churchSlug={churchSlug} />)}
      </main>
      <footer className="mt-12 border-t border-[var(--site-line)] px-6 py-6 text-center text-base text-[var(--site-muted)]">© {site.churchName}</footer>
    </div>
  );
}

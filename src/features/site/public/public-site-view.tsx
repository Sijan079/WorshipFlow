import type { PublicBlock, PublicSite } from "./public-site-data";
import type { SiteLink, TextRun } from "@/features/site/blocks/block-validation";
import { COVER_OVERLAY, coverFocusPosition } from "@/features/site/blocks/cover-style";
import { lookVariables } from "@/features/site/look/look";
import { pageHref } from "@/features/site/look/site-chrome";
import { CarouselScroller } from "./carousel-scroller";
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

function Block({ block, churchSlug, nested = false, asH1 = false }: { block: PublicBlock; churchSlug: string; nested?: boolean; asH1?: boolean }) {
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
    case "IMAGE": {
      // Full width pictures run edge to edge with square corners; the others keep rounded corners.
      const full = block.width === "full" && !nested;
      return (
        <figure className={`${full ? "" : "my-6"} ${block.align === "center" ? "text-center" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- already a small WebP made by the site's own upload */}
          <img src={block.src} alt={block.alt} width={block.naturalWidth} height={block.naturalHeight} loading="lazy" className={`h-auto max-w-full ${full ? "w-full" : "rounded-lg"} ${block.align === "center" ? "mx-auto" : ""}`} />
          {block.caption ? <figcaption className="mt-2 px-6 text-base text-[var(--site-muted)]">{block.caption}</figcaption> : null}
        </figure>
      );
    }
    case "SECTION":
      return <SectionView block={block} churchSlug={churchSlug} />;
    case "COVER":
      return <CoverView block={block} churchSlug={churchSlug} asH1={asH1} />;
    case "COLUMNS":
      return (
        <div className={`site-columns ${block.cards ? "site-columns-cards" : ""}`} data-count={block.columns.length} data-valign={block.valign}>
          {block.columns.map((column, index) => (
            <div key={index} className="site-column">
              {column.map((child) => <Block key={child.id} block={child} churchSlug={churchSlug} nested />)}
            </div>
          ))}
        </div>
      );
    case "CAROUSEL":
      return (
        <CarouselScroller label={block.label ?? "Cards"} perView={block.perView}>
          {block.cards.map((card, index) => (
            <li key={index} className="site-carousel-card">
              {/* eslint-disable-next-line @next/next/no-img-element -- already a small WebP made by the site's own upload */}
              {card.pictureSrc ? <img src={card.pictureSrc} alt="" loading="lazy" className="site-carousel-picture" /> : null}
              <div className="site-carousel-body">
                <h3 className="text-xl font-semibold">{card.title}</h3>
                {card.text ? <p className="mt-2 text-lg leading-relaxed">{card.text}</p> : null}
                {card.button ? (
                  <a className="site-carousel-link" href={hrefOf(card.button.link, churchSlug)} {...(isOutside(card.button.link) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    {card.button.label}
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </CarouselScroller>
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
            className="inline-block rounded-lg bg-[var(--site-btn-bg)] px-6 py-3 text-lg font-semibold text-[var(--site-btn-text)]"
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

const OVERLAY = { light: 0.25, medium: 0.45, strong: 0.65 } as const;

// A hero: a picture (or the church colour) with a headline, a line of words and up to two buttons on top. The picture
// is always darkened, so the white words stay readable on a bright photo.
function CoverView({ block, churchSlug, asH1 = false }: { block: Extract<PublicBlock, { type: "COVER" }>; churchSlug: string; asH1?: boolean }) {
  const Heading = asH1 ? "h1" : "h2";
  const shade = `rgba(10, 12, 30, ${COVER_OVERLAY[block.overlay]})`;
  const style = block.pictureSrc
    ? { backgroundImage: `linear-gradient(${shade}, ${shade}), url("${block.pictureSrc}")`, backgroundPosition: `center, ${coverFocusPosition(block.focus)}`, backgroundSize: "cover" }
    : undefined;
  const centred = block.align === "center";
  return (
    <section className={`site-cover ${block.width === "wide" ? "rounded-lg" : ""}`} data-height={block.height} style={style}>
      <div className={`site-content site-gutter w-full py-12 ${centred ? "text-center" : "text-left"}`}>
        <Heading className="text-4xl font-bold leading-tight @2xl:text-5xl">{block.headline}</Heading>
        {block.text ? <p className="mt-4 whitespace-pre-line text-xl leading-relaxed @2xl:text-2xl">{block.text}</p> : null}
        {block.buttons.length > 0 ? (
          <p className={`mt-8 flex flex-wrap gap-3 ${centred ? "justify-center" : "justify-start"}`}>
            {block.buttons.map((button, index) => (
              <a
                key={index}
                className={`site-cover-button ${button.style === "filled" ? "site-cover-button-filled" : "site-cover-button-outline"}`}
                href={hrefOf(button.link, churchSlug)}
                {...(isOutside(button.link) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {button.label}
              </a>
            ))}
          </p>
        ) : null}
      </div>
    </section>
  );
}

// A band with its own background. Its blocks sit in an inner column at the reading width or the wide width.
function SectionView({ block, churchSlug }: { block: Extract<PublicBlock, { type: "SECTION" }>; churchSlug: string }) {
  const tone = block.background === "dark" || block.background === "accent" || block.background === "picture" ? "dark" : "light";
  const style = block.background === "picture" && block.pictureSrc
    ? { backgroundImage: `linear-gradient(rgba(10, 12, 30, ${OVERLAY[block.overlay]}), rgba(10, 12, 30, ${OVERLAY[block.overlay]})), url("${block.pictureSrc}")` }
    : undefined;
  return (
    <section className="site-section" data-bg={block.background} data-tone={tone} data-pad={block.padding} style={style}>
      <div className={`${block.inner === "wide" ? "site-wide" : "site-content"} site-gutter`}>
        {block.blocks.map((child) => <Block key={child.id} block={child} churchSlug={churchSlug} nested />)}
      </div>
    </section>
  );
}

// Each block on the page sits at its own width: the reading width, wide, or the full screen.
function widthOf(block: PublicBlock): "content" | "wide" | "full" {
  if (block.type === "SECTION" || block.type === "COVER" || block.type === "COLUMNS" || block.type === "CAROUSEL") return block.width;
  if (block.type === "IMAGE") return block.width;
  return "content";
}

function Row({ width, children }: { width: "content" | "wide" | "full"; children: React.ReactNode }) {
  if (width === "full") return <div>{children}</div>;
  // A wide Section brings its own gutter; everything else needs one so text never touches the screen edge.
  return <div className={`${width === "wide" ? "site-wide" : "site-content"} site-gutter`}>{children}</div>;
}

// The header: the church's logo or name, the menu, and an optional call-to-action button. On a narrow page the menu
// folds into a Menu button (a plain disclosure, no script).
function SiteHeader({ site, churchSlug, preview }: { site: PublicSite; churchSlug: string; preview: boolean }) {
  const items = site.menu.length > 1 ? site.menu : [];
  const link = (item: { slug: string; title: string }) => {
    const current = item.slug === site.page.slug;
    const className = `site-nav-link ${current ? "site-nav-current" : ""}`;
    return preview
      ? <span className={className}>{item.title}</span>
      : <a href={pageHref(churchSlug, item.slug)} aria-current={current ? "page" : undefined} className={className}>{item.title}</a>;
  };
  const brand = site.header.logoSrc
    // eslint-disable-next-line @next/next/no-img-element -- the church's own small WebP
    ? <img src={site.header.logoSrc} alt={site.churchName} className="site-logo" />
    : <span className="site-brand-name">{site.churchName}</span>;
  const button = site.header.button;
  return (
    <header className="site-header">
      <div className="site-wide site-gutter site-header-row">
        {preview ? <span className="site-brand">{brand}</span> : <a href={pageHref(churchSlug, "home")} className="site-brand">{brand}</a>}
        {items.length > 0 ? (
          <nav aria-label="Main menu" className="site-nav-wide">
            <ul>{items.map((item) => <li key={item.slug}>{link(item)}</li>)}</ul>
          </nav>
        ) : null}
        <div className="site-header-actions">
          {button ? (preview ? <span className="site-header-button">{button.label}</span> : <a href={button.href} className="site-header-button">{button.label}</a>) : null}
          {items.length > 0 ? (
            <details className="site-menu-narrow">
              <summary>Menu</summary>
              <ul>{items.map((item) => <li key={item.slug}>{link(item)}</li>)}</ul>
            </details>
          ) : null}
        </div>
      </div>
    </header>
  );
}

// The footer: who and where, when, and a link to every page.
function SiteFooter({ site, churchSlug, preview }: { site: PublicSite; churchSlug: string; preview: boolean }) {
  const { address, phone, email, serviceTimes } = site.footer;
  const hasContact = Boolean(address || phone || email);
  return (
    <footer className="site-footer">
      <div className="site-wide site-gutter">
        <div className="site-footer-grid">
          <div>
            <p className="site-footer-name">{site.churchName}</p>
            {hasContact ? (
              <p className="site-footer-text">
                {address ? <span className="block whitespace-pre-line">{address}</span> : null}
                {phone ? <span className="block">{phone}</span> : null}
                {email ? <span className="block">{email}</span> : null}
              </p>
            ) : null}
          </div>
          {serviceTimes.length > 0 ? (
            <div>
              <h2 className="site-footer-heading">Service times</h2>
              <p className="site-footer-text">{serviceTimes.map((line, index) => <span key={index} className="block">{line}</span>)}</p>
            </div>
          ) : null}
          {site.menu.length > 1 ? (
            <div>
              <h2 className="site-footer-heading">Pages</h2>
              <ul className="site-footer-links">
                {site.menu.map((item) => <li key={item.slug}>{preview ? <span>{item.title}</span> : <a href={pageHref(churchSlug, item.slug)}>{item.title}</a>}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
        <p className="site-footer-legal">© {new Date().getFullYear()} {site.churchName}</p>
      </div>
    </footer>
  );
}

// In the editor's preview the menu and the buttons are shown but do not leave the editor.
export function PublicSiteView({ site, churchSlug, preview = false }: { site: PublicSite; churchSlug: string; preview?: boolean }) {
  // When the page title is hidden, the first Cover's headline is the page's one main heading.
  const mainCoverId = site.page.showTitle ? undefined : site.page.blocks.find((block) => block.type === "COVER")?.id;
  return (
    <div className="public-site @container min-h-screen" style={lookVariables(site.look.colorSet, site.look.fontStyle) as React.CSSProperties}>
      <SiteHeader site={site} churchSlug={churchSlug} preview={preview} />
      <main className={site.page.showTitle ? "py-10" : "pb-10"}>
        {site.page.showTitle ? <Row width="content"><h1 className="mb-6 text-4xl font-bold leading-tight">{site.page.title}</h1></Row> : null}
        {site.page.blocks.map((block) => <Row key={block.id} width={widthOf(block)}><Block block={block} churchSlug={churchSlug} asH1={block.id === mainCoverId} /></Row>)}
      </main>
      <SiteFooter site={site} churchSlug={churchSlug} preview={preview} />
    </div>
  );
}

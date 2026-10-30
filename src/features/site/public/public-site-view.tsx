import type { PublicBlock, PublicSite } from "./public-site-data";
import "./public-site.css";

function when(startsAt: string, timezone: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "full", timeStyle: "short", timeZone: timezone }).format(new Date(startsAt));
}

function Block({ block }: { block: PublicBlock }) {
  switch (block.type) {
    case "HEADING":
      return <h2 className="mt-12 mb-3 text-2xl font-semibold">{block.text}</h2>;
    case "RICH_TEXT":
      return <p className="my-4 whitespace-pre-line text-lg leading-relaxed">{block.text}</p>;
    case "SERVICE_TIMES":
      return (
        <section className="my-6 rounded-lg bg-[var(--site-soft)] px-6 py-5">
          <h2 className="mb-2 text-2xl font-semibold">Service times</h2>
          {block.lines.map((line) => <p key={line} className="text-lg">{line}</p>)}
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

export function PublicSiteView({ site }: { site: PublicSite }) {
  return (
    <div className="public-site min-h-screen">
      <header className="border-b border-[var(--site-line)] px-6 py-4 text-xl font-bold">{site.churchName}</header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-4xl font-bold leading-tight">{site.page.title}</h1>
        {site.page.blocks.map((block) => <Block key={block.id} block={block} />)}
      </main>
      <footer className="mt-12 border-t border-[var(--site-line)] px-6 py-6 text-center text-base text-[var(--site-muted)]">© {site.churchName}</footer>
    </div>
  );
}

# Product

Baseline: 2026-10-26, revised same day (see `docs/changes/20261026.md`).
Later changes are recorded in `docs/changes/YYYYMMDD.md`.

## What WorshipFlow is

A church management system (CMS) for multiple churches, with a public church
website per church. Each church is a workspace. It started as a worship-service
preparation tool; that work is now one module (Worship) inside a broader church
workspace.

Why the change: most of the original production functions (song formatting,
praise-item retrieval) are used rarely, because the church's songs are already
formatted. The product needed a daily-use purpose.

## Who it is for

- First: one church (Angeles City Bible Church), whose attendees are largely
  seniors aged 60+ who are not tech-savvy.
- Congregants do not log in. The tech team (Owner/Admin and granted Members)
  manages all data. Congregants see only the public church site.
- Later: other churches, each as its own workspace. Workspaces are created by
  hand (admin provisioning). No self-serve signup, billing, or onboarding until
  the CMS works for one real church.

## Two surfaces

- **App** at `/w/{workspaceSlug}`: login required, used by the tech team.
- **Public site** at `/c/{workspaceSlug}`: no login, anyone with the URL.
  Unlisted by default; a per-church switch makes it indexable by search engines.

## Modules (first cut)

| Module | Purpose |
| --- | --- |
| People | Directory of persons: members, regular attendees, visitors |
| Ministries | Groups people serve or belong to (Youth, Ladies, Men's, Tech, Music, Pastors, ...) |
| Events | Calendar of church activities, with optional repeat |
| Announcements | Church-wide announcements, manually authored |
| Page Builder | Public church website: pages built from blocks, plus posts. Internally the data models are named Site* |
| Worship | Sub-navigation: Services, Songs, Media Tools, Captions |
| Dashboard | Four plain summary cards |
| Settings | Workspace, membership, templates, integrations, usage, site visibility |

### Dashboard cards

1. This week's service status
2. Upcoming events
3. Latest service headcount (or "not recorded")
4. Roster counts by person status (Visitor, Regular, Member, Inactive, Archived)

Each links into its module. No charts or trends until there is enough data.

### Page Builder (the public site)

- Pages are edited in a WordPress-style stack-of-blocks editor: text is typed directly on the page, other
  blocks open a settings panel (a bottom sheet on phones), with autosave, undo and redo, and a Preview with
  phone, tablet and desktop widths. Blocks: paragraph, heading, list, quote, image, button, spacer,
  announcements list, events list, service times, contact, and layout blocks: Section (a full-width band with a
  background that holds blocks), Cover (a hero picture with text and buttons on top), Columns (2 to 4, stacked
  on phones) and Carousel (2 to 12 cards that scroll sideways, no autoplay; used for things like the ministries). Blocks can be content width (720 px), wide (1200 px) or full width. A fixed site header and footer
  with a call-to-action button, a Look section in Website settings (5 colour sets, 2 font styles, a logo), a "show
  the page title" switch, "make this the home page", and starter pages (Blank, Homepage, Plan your visit, About
  us). See `docs/changes/20261030.md` items 16 to 19. Options are only left or centre alignment and
  normal or large text. Posts are a content type (see Announcements above) with title, body, publish date,
  and a public flag; Articles are a separate step after the editor.
- A church has many pages (at most 20, with at most 100 blocks each, nested ones included) and a header menu built from its
  published pages in an order the church sets. Addresses come from page titles. The first page is the home
  page and cannot be deleted; other pages are deleted only as drafts. Each page has an optional search
  description. A second person opening a page being edited gets view-only.
- Images are converted to WebP, shrunk to 1600 px wide, limited to 10 MB, and need alt text. Links allow only
  http, https, tel and mailto.
- Public only by opt-in per item. People data never appears.
- No custom HTML, CSS, or JavaScript, and no themes beyond a logo and a color
  and font preset (5 colours, 2 fonts). A ready-made home page ships with each new church as an ordinary,
  editable page.
- It is built after Announcements and is the roadmap step most likely to slip.

### Worship

Sub-navigation: Services, Songs, Media Tools, Captions. Services is the
flagship and keeps its template-driven, strict stored-order blocks. Tools stay,
but each is being rethought individually (see Roadmap). They remain tools inside
Worship; they are not standalone modules.

- Background generator: moving from AI generation toward a curated per-workspace
  library of images and 1080p video loops. AI generation may return later as an
  "add to library" action once cost and provider are decided.
- Phone transfer, comment card, QR generator: kept, refined first.
- Song formatter, resize image, background removal: kept, no new investment now.
- Captions: optional module behind its own permissions and flag. One stable link per church (shared as a QR code)
  serves the congregation; Start and Stop only control whether captions are live.

## Behaviors that define the product

- Attendance is a headcount. A worship service has one optional headcount field.
  Events have an optional per-occurrence headcount. Named check-in is an
  optional per-church setting for events only, never required.
- Events: every event has a start and an end and may span several days.
  Repeat: None, Daily, or Weekly (choose days of the week). No Monthly.
  Repeat ends on a date or never; open-ended series only keep the next
  4 months of occurrences. Each occurrence can be edited or cancelled alone.
  A one-off event covers things like a monthly fellowship whose time varies.
  Overlapping events warn but never block.
- Posts are one content type with a kind. An Announcement is a short, timely
  post: title, body, optional event link, draft/published status, start and end
  date, public flag. An Article (step 8) is a longer, lasting post with its own
  page. Both share one publishing flow. Facebook/Instagram text is plain copy-paste
  text. Auto-publishing to social media is a future feature, not built now.

## Deferred (not in the first cut)

Giving/finance, pastoral care, small groups, named check-in for worship services,
visitor follow-up workflows, monthly repeat, "this and all following" editing,
congregant logins and profiles, event RSVP, auto-publishing to social media,
custom domains for the public site, a free-form or custom-code page builder (the WordPress-style block editor is in scope), galleries, video and embeds, revision history,
self-serve church signup and billing, AI background generation, charts and
trends on the Dashboard, the desktop (Tauri) app and any local SQLite sync path.

## Rules carried over from the old product

- A WorshipService is one real service; new services copy active template blocks
  in order and render in strict stored order. Do not hard-code a global sequence.
- Services and Events are separate objects. Do not stretch WorshipService to cover
  unrelated church activities.
- Generated outputs and automation jobs are stored records, not UI-only state.

# Access and Privacy

Baseline: 2026-10-26, revised same day (see `docs/changes/20261026.md`).
Later changes are recorded in `docs/changes/YYYYMMDD.md`.

## Accounts

Accounts (`User`) are tech-team accounts. Congregants do not log in. The tech
team enters and edits all People data; congregants only see the public site.

## Roles and grants

- Workspace roles stay Owner, Admin, Member.
- Per-person, per-module, per-action grants stay, with workspace-level Member
  defaults. Only Owner/Admin can administer grants. Every route handler enforces
  the check itself; the proxy does not authorize.
- New module PEOPLE with actions VIEW, CREATE, EDIT, DELETE. Member default:
  no access. Owner/Admin have full access. Team-leader scoped access (a leader
  sees only their ministry) is a later addition.
- Ministries: access follows PEOPLE for now. Decide separately if it needs its
  own grants.
- Site management (pages, posts, publish) is a module with its own actions
  (VIEW, CREATE, EDIT, DELETE, PUBLISH). Exact enum names are set in
  `Data-Model.md`.

## Public site

- Served without login at `/c/{workspaceSlug}`.
- Opt-in per item: an announcement, event, post, or page is public only when
  marked public (and, for announcements and posts, published).
- `Person`, ministry membership, birthdates, baptism records, attendance, and
  service assignments never appear on the public site. Public routes read only
  a small set of public-safe fields, and no public route may query those
  tables. A test must prove this.
- Visibility switch per church: **indexable** (search engines may list it) or
  **unlisted** (`noindex`, no sitemap). Default unlisted. `noindex` is a request
  to well-behaved crawlers, not access control; the URL can still be shared.
  Nothing private ever goes on the public site.
- Page content is structured blocks, not raw HTML, to avoid stored cross-site
  scripting. Rich text is a restricted subset.
- Public endpoints are rate limited and cached.

## Hiding the admin app is not security

The app at `/w/{slug}` is not protected by its path being unknown. Every request
needs a login, workspace membership, and a role/grant check inside the route
handler.

## Privacy baseline

Birthdates, baptism records, and church membership are personal data about
religious affiliation. If the church operates in the Philippines, the Data
Privacy Act likely treats religious affiliation as sensitive personal
information. This is an unverified reading, not legal advice; get qualified
advice before onboarding churches other than the first.

First-cut minimum:

- Record who created, edited, or deleted a person, and when.
- Owner/Admin can export a person's data and permanently delete it.
- A short "why we collect this" note appears on the People screen.
- Viewing is not logged yet.
- Member records are never visible across workspaces.

## Other rules kept

- Event conflict warnings never block an organizer's decision to proceed.
- Captions keep their own VIEW and OPERATE permissions.
- Secrets (provider keys, OAuth client secrets, DB dumps) are never committed.

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
- Module PEOPLE (built, step 2) with grantable actions VIEW, CREATE, and EDIT
  (edit includes archive). Member default: no access. Create and Edit also
  require View. **Hard delete is not grantable**: only Owner and Admin can
  permanently delete a person. Owner/Admin have full access. Team-leader scoped
  access (a leader sees only their ministry) is a later addition.
- Ministries follow PEOPLE (decided 2026-10-26). Give them their own grants only
  if a real need appears. Rules live in
  `src/features/people/people-access-rules.ts`, enforced per route handler with
  `requirePeopleAction`.
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

## Names for service pickers

`/api/people/names` returns only an id and a display name ("Bro.", "Sis." or "Ptr." by gender
and the Pastors ministry, then first and last name) for people who are not Archived or
Inactive. Any member of the workspace can read it, because building a service must not need
access to the People directory. It never returns birthdates, baptism details, or anything else
from the directory, and it never appears on the public site.

`/api/ministries/options` is the same kind of endpoint for a service's ministry choice: any
workspace member can read the active ministries (id, code, label, and whether it is service-only)
and nothing about their members.

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
- No on-screen "why we collect this" note (removed at the owner's request on
  2026-10-26). Access control, the edit record, and admin-only delete carry the
  baseline; revisit before onboarding other churches.
- Viewing is not logged yet.
- Member records are never visible across workspaces.

## Other rules kept

- Event conflict warnings never block an organizer's decision to proceed.
- Captions keep their own VIEW and OPERATE permissions.
- Secrets (provider keys, OAuth client secrets, DB dumps) are never committed.

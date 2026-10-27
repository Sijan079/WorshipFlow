# Roadmap

Baseline: 2026-10-26, revised same day (see `docs/changes/20261026.md`).
Later changes are recorded in `docs/changes/YYYYMMDD.md`.
Each step ends with a stated check. Follow the repo's iterative loop: plan,
write the failing check first, build, verify, document.

## Done

- Legacy `src/app/(workspace)/*` route tree deleted. `w/[workspaceSlug]` is the
  only app page tree. Legacy bare paths redirect to `/workspaces`.
  Check: `npm test` passes; no `src/` type errors.

## Order

1. **Person and Ministry schema** (done 2026-10-26). Additive only: `Person`,
   `Ministry`, `PersonMinistry`, optional `personId` on the two assignment tables,
   default Ministries seeded per workspace. No behavior change; Teams and the
   service pickers still use `Servant`. No data migration; the roster is entered
   fresh in step 3.
   Check: `npm test` (schema and migration shape, default Ministries); hosted DB
   shows 0 people, the Ministries seeded, and the Servant table untouched.
2. **PEOPLE permission module** (done 2026-10-26). Grantable VIEW, CREATE, EDIT;
   hard delete stays Owner/Admin only; Ministries follow PEOPLE. The Membership
   settings list it automatically. No People route handlers exist yet, so
   enforcement is `requirePeopleAction`, ready for step 3.
   Check: `npm test` covers the role and grant matrix (Member with no grant is
   refused; a granted Member can read; Create and Edit need View; Delete is never
   granted to a Member); the permissions route accepts PEOPLE; hosted enum has it.
3. **People and Ministries screens.** One step, built in this order, tests first,
   one commit per piece: schema (split name, service `ministryId`, queue the
   Servant drop); People API; People screen and person dialog; Ministries API and
   screen; switch the service pickers, text parser and "add to roster" flow to
   People; switch the service ministry to `Ministry`; remove the Teams page,
   `/api/servants`, and the two Settings preset sections, and put People and
   Ministries in the nav. The roster is entered fresh by hand (no bulk add).
   The `drop_servants` migration (drops `Servant` data) was applied on 2026-10-27.
   **Progress (2026-10-26):** built and committed: schema, People API, People
   screen, Ministries API and screen, nav entries, the service pickers and parser
   reading People, the service ministry reading Ministry, and removal of Teams,
   `/api/servants`, the two Settings preset sections, and the Servant models from
   the schema. People and Ministries were checked in the browser; the service
   changes were checked by tests, types, lint, and the database. The
   `drop_servants` migration was applied on 2026-10-27, so nothing remains.
   Check: create, edit, archive, restore; hard delete is Owner/Admin only;
   baptism date is rejected unless status is BAPTIZED.
   After this step, write a thin project design skill in `.claude/skills/` that
   holds the UI build and review procedure and points at `DESIGN.md` for the
   rules, using what the first People screens taught us.
4. **Keep-alive job** (built 2026-10-26; daily Vercel Cron, protected route, one small
   write). Checked locally: the route refuses a missing or wrong secret, a right-secret call
   writes exactly one row, and a repeat run is harmless. **Not yet live:** it needs
   `CRON_SECRET` set in the Vercel project's Production environment and the code merged to
   `main`; then confirm in Vercel's Cron Jobs settings that it runs, and watch that the Supabase
   project stays active for a week.
5. **Design contract** (done 2026-10-26): `DESIGN.md` records the hand-built
   approach as the contract for new screens. The public-site template is designed
   in step 8.
6. **Events: repeat rule (None, Daily, Weekly), multi-day, optional headcount,
   `isPublic`; service headcount.**
   Check: weekly series creates the right occurrences; open-ended series keeps
   a 4-month window; one occurrence can be edited or cancelled alone.
   **Progress (2026-10-27):** data and API built and tested (repeat engine, validation, create, series
   edit, single-date edit, service headcount, daily top-up); see `docs/changes/20261027.md` item 10.
   The migration `20261028000000_event_repeat_rule` was applied and the Events screen was built (repeat
   controls, multi-day dates, Public switch, edit, cancel, restore, service attendance); see item 14.
   Remaining: change how an existing event repeats from the screen, and checking it in a browser.
7. **Announcements**, with `isPublic`.
8. **Page Builder (public site) and posts**, public at `/c/{workspaceSlug}`, with the
   indexable/unlisted switch. Largest step, and the one most likely to slip.
   Check: a test proves public routes cannot read People, Ministry, or
   attendance data; unlisted sends `noindex`; only items marked public appear.
9. **Dashboard** with four summary cards.
10. **Design unification pass.** Bring the older pages in line with `DESIGN.md` one page at a time (Services,
    Settings, People, Media Tools, the Song Formatter, and the rest) using its checklist: no cards inside
    cards, quiet icon controls, Title Case dialog titles, Cancel and Done, "Yes, I am sure" on serious
    confirmations, things that move glide instead of jump, and the older Delete buttons. If the secondary
    accent trial (sky blue) is kept, roll it out and remove the trial note; if not, point the tokens back
    at purple. A page needs its own grilling session only if it needs a new `DESIGN.md` rule.
11. **Worship sub-navigation regrouping** (Services, Songs, Media Tools,
    Captions).
12. **Tool refinements**, starting with the background library (images and 1080p
    loops up to 50 MB, per-workspace storage meter). Then phone transfer,
    comment card, QR generator.
13. **Rewrite `AGENTS.md` and `README.md`** to point at these docs.

## Design direction

Decided 2026-10-26: no mockup set is chosen. The direction is the approach
already hand-built into Services, Teams, the Song Formatter, and Settings, kept
as written in `DESIGN.md`, with the dark rail retained and plainer, more
accessible wording and sizes for new screens. `public/mockups/` depicts the old
production product and can be deleted. The public site gets its own look, the
church's identity, designed in step 8.

## Open questions

- Ministries: own grants, or follow PEOPLE.
- Whether named check-in becomes a per-church setting, and its UI.
- Free-plan backup behavior (verify on the Supabase dashboard).
- Whether Vercel Hobby fits the real setup. Decided trigger for a paid plan: when
  another church asks to be incorporated into the system.
- Privacy: confirm applicable law with qualified advice.
- Which tools are "usable already" beyond phone transfer, comment card, QR.
- Site details: navigation menu shape, number of block types in version one,
  and whether posts need categories.

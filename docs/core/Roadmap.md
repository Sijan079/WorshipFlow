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
   Applying `prisma/deploy-queue/` (drops `Servant` data) happens at deploy time.
   **Progress (2026-10-26):** built and committed: schema, People API, People
   screen, Ministries API and screen, nav entries, the service pickers and parser
   reading People, the service ministry reading Ministry, and removal of Teams,
   `/api/servants`, the two Settings preset sections, and the Servant models from
   the schema. People and Ministries were checked in the browser; the service
   changes were checked by tests, types, lint, and the database. Remaining: apply
   `prisma/deploy-queue/` (drops the old Servant data) when the new code is
   merged and deployed.
   Check: create, edit, archive, restore; hard delete is Owner/Admin only;
   baptism date is rejected unless status is BAPTIZED.
   After this step, write a thin project design skill in `.claude/skills/` that
   holds the UI build and review procedure and points at `DESIGN.md` for the
   rules, using what the first People screens taught us.
4. **Keep-alive job** (daily Vercel Cron, protected route, one small write).
   Check: route rejects calls without the secret; a write is recorded; confirm
   in the Supabase dashboard that the project stays active.
5. **Design contract** (done 2026-10-26): `DESIGN.md` records the hand-built
   approach as the contract for new screens. The public-site template is designed
   in step 8.
6. **Events: repeat rule (None, Daily, Weekly), multi-day, optional headcount,
   `isPublic`; service headcount.**
   Check: weekly series creates the right occurrences; open-ended series keeps
   a 4-month window; one occurrence can be edited or cancelled alone.
7. **Announcements**, with `isPublic`.
8. **Page Builder (public site) and posts**, public at `/c/{workspaceSlug}`, with the
   indexable/unlisted switch. Largest step, and the one most likely to slip.
   Check: a test proves public routes cannot read People, Ministry, or
   attendance data; unlisted sends `noindex`; only items marked public appear.
9. **Dashboard** with four summary cards.
10. **Worship sub-navigation regrouping** (Services, Songs, Media Tools,
    Captions).
11. **Tool refinements**, starting with the background library (images and 1080p
    loops up to 50 MB, per-workspace storage meter). Then phone transfer,
    comment card, QR generator.
12. **Rewrite `AGENTS.md` and `README.md`** to point at these docs.

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

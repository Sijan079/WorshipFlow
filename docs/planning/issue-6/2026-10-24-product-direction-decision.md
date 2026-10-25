# Issue #6: Product Direction Decision Brief

**Status:** Direction selected in conversation on 2026-10-24; implementation design remains under review.  
**Source:** [GitHub issue #6](https://github.com/Sijan079/WorshipFlow/issues/6), opened 2026-10-24.  
**Decision owner:** Product owner.  
**Decision:** Grow WorshipFlow into a church management system in the existing workspace, with worship production preserved as a separate flagship workflow. Start with Events and Announcements; finance and member coordination are lower priority.

## Why this decision is needed

Issue #6 proposes four phases, from volunteer coordination and run mode through member records, events, finance, communications, and pastoral care. It explicitly requests a direction decision before those modules become implementation work. Current [AGENTS.md](../../../AGENTS.md), [architecture](../../architecture.md), and [service flow spec](../../specs/service-flow/spec.md) limit the product to worship service preparation and exclude general events, scheduling, messaging, and complex role systems. The issue is a proposal to revisit that boundary, not authorization to change it.

The current `Workspace` is a church-level tenant, while `WorshipService` remains one real worship service. Existing tenancy can inform either option; it does not, by itself, establish the data model or permissions needed for wider church records.

## Evidence from the current implementation

| Current fact | Planning implication |
| --- | --- |
| [`WorshipService`](../../../prisma/schema.prisma) owns ordered service blocks and assignments. Template blocks are copied at creation, then the service owns its flow. | Any option must preserve stored service order and keep production screens focused. |
| `Servant` stores a workspace-scoped name and group, while `ServiceServantAssignment` stores `personName` for a service role. `BlockPerson` also stores a name. | Volunteer confirmation cannot safely infer which signed-in user owns a name-based assignment. A link and migration policy need design. |
| [`security-context.ts`](../../../src/lib/security-context.ts) permits `MEMBER` reads and restricts workspace writes to `ADMIN`/`OWNER` in scoped requests. | Self-service availability and responses need explicit, narrow authorization in handlers. |
| [`Song`](../../../prisma/schema.prisma) already has `defaultKey` and `bpm`. | Part of the proposed music metadata is already modeled; inspect the UX and gaps before creating another schema. |
| The app has workspace-scoped routes, Prisma persistence, Supabase Auth, and private output storage. | The existing modular monolith is a sensible starting point for discovery; platform splitting is not a prerequisite. |

These are source-level findings, not evidence that the proposed workflows are already usable end to end.

## Options

| | A — Focused worship production | B — Incremental church management |
| --- | --- | --- |
| Product promise | Prepare and run one worship service accurately, including closely related team and media handoff work. | Manage broader church operations, with worship production as the flagship module. |
| Work admitted now | Issue #6 Phase 1 candidates only when tied to a real service; consider volunteer confirmation after its access design. | Define independently releasable modules, starting with Events; later modules need separate designs and approvals. |
| Boundary | No generic events, member directory, finance, communications, or pastoral records. | New `ChurchEvent` and `ChurchMember` concepts may be justified, but neither is an alias for `WorshipService` or `User`. |
| Benefit | Protects the fast production workflow and reduces data, permission, support, and migration surface. | Could reduce tool fragmentation for churches if there is evidence of demand and capacity to operate sensitive modules. |
| Cost and risk | Some church-wide needs remain in other tools; integration or export may be needed. | Larger navigation and data model; financial, pastoral, and minors' data require stronger permissions, auditing, retention, and operations. |
| Documentation consequence | Keep the current scope rules and amend them only for explicitly approved service-adjacent slices. | First approve a revised product charter and update `AGENTS.md`, README, architecture, roadmap, and feature specs before implementation. |

### Selected direction

The owner chose **B**, focused first on event management: announcements, registration links, and date coordination. The event types named were fellowships, weekly prayer meetings, Christmas parties, performances such as *Mahal na Araw*, and water baptisms. Finance and general member coordination are lower priority. See the [Events foundation design](./2026-10-24-events-foundation-design.md) for the concrete first module. Volunteer confirmation remains a separate later slice.

## Further validation for the selected direction

Before committing to later, more sensitive modules, answer these with evidence from intended churches and maintainers:

1. Which two or three church-wide workflows are presently painful enough to justify a single platform, and who will use them weekly?
2. Who can own access policy, incident response, backups, retention, and deletion for member, donation, minors', and pastoral records?
3. What measurable production outcomes must remain fast and clear after new navigation and data appear?
4. Which modules can ship and be maintained independently without requiring the others?
5. What is the migration and support budget for linking existing name-only servant and assignment records to people/accounts?

The conversation established Events as the first unmet workflow. The other operational questions remain open and should be answered before finance, member records, or pastoral care enter implementation.

## Scope guardrails under either choice

- Preserve `WorshipService` as one real service; never use it for a general event.
- Preserve each service's copied, stored block order, including after template edits.
- Keep tenant-scoped authorization in route handlers; Proxy redirects are not a data-access boundary.
- Keep service production screens and navigation quick to scan under pressure.
- Keep persistence contracts compatible with a future local SQLite sync path; identify cloud-dependent features separately.
- Treat optional modules as separate decisions with their own data ownership, privacy, migrations, and acceptance criteria.

## Decision record

| Field | Entry |
| --- | --- |
| Selected option | B — incremental church management in the existing workspace |
| Why this option | Event announcements, registration, and date coordination are the first unmet church-wide needs |
| Date and owner | 2026-10-24; product owner in this conversation |
| First design slice | Events foundation; migration and visual design review first |
| Explicitly deferred modules | Finance, general member coordination, volunteer confirmation, pastoral care, and YouTube publishing |
| Follow-up docs/issues | Events foundation design; implementation plan after design approval |

The product direction has been selected. Update the repository's scope rules and architecture as part of the approved Events foundation implementation, while keeping the first migration and visual review narrowly scoped.

# ADR-0001: Workspace Settings Boundary and Template Source of Truth

## Status

Accepted

## Context

Settings previously relied on implicit workspace resolution, loaded every
collection in one client component, and maintained both legacy template JSON
and normalized ordered template rows. AI configuration was deployment-only.

## Decision

- Use `/w/{workspaceSlug}/settings` as the canonical Settings route.
- Require explicit workspace membership for all Settings API operations.
- Allow active members to read safe settings; restrict writes to owners/admins.
- Make `ServiceTemplateBlock` the source of truth for ordered template blocks.
- Pin published program-block versions and snapshot them into new services.
- Store optional workspace AI credentials encrypted server-side and redact them
  from all API responses.

## Consequences

### Positive

- Workspace isolation is explicit and testable.
- Template order has one persistence contract.
- Existing services remain stable after template edits.
- Workspace integrations can be configured without exposing secrets.

### Negative

- A migration is required for legacy template JSON.
- Settings writes need a server encryption key for integration overrides.
- The Settings UI has more workspace administration than the previous 1.1
  configuration-only scope.

## Alternatives Considered

- Keep both template representations synchronized: rejected because it retains
  the original source-of-truth failure mode.
- Keep deployment-only integrations: rejected because workspace configuration
  was explicitly requested.
- Keep implicit default-workspace API access: rejected because it weakens the
  tenant boundary.

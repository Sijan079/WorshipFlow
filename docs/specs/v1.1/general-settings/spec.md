# General Settings Expansion Spec

**Status:** Implemented; pending review
**Release:** 1.1

## Purpose

Give operators a truthful view of workspace-level configuration and AI
availability without introducing the account and organization work planned for
1.2.

## Sections

### Workspace Presets

- Keep existing Ministries and Servant Groups management in General.
- These presets remain worship-service preparation inputs, not a church member
  directory or scheduling system.

### AI Usage

- Show usage or estimated cost only when the application already has a reliable
  value for the configured provider and period.
- Label estimates as estimates and show their period and unit.
- If remaining provider credits are unavailable, show `Not available` with a
  short explanation; never calculate or imply a balance from incomplete data.
- A link to the provider's own usage/billing surface is allowed when applicable.

### Access Control

- Show the current access mode and whether shared application access is
  configured.
- 1.1 does not create users, invitations, memberships, roles, or permissions.
- Include a clear note that managed individual access is planned with the 1.2
  account/organization model.

### AI Integrations

- Show whether each AI capability is configured and available from the server.
- Never expose secrets, full keys, environment-variable values, or provider
  responses containing sensitive details.
- Connection status is read-only in 1.1.
- OpenAI OAuth, user-owned billing, and bring-your-own-account flows are deferred
  until an explicit security and ownership design is approved.

## Data and Security

- Prefer status derived from existing server configuration and persisted jobs.
- Do not add a billing table, credential table, organization model, or generic
  integration framework for 1.1.
- Any status endpoint must return booleans or safe labels, not credentials.
- Unavailable and unauthorized data must be represented explicitly, not as zero.

## States

- Available: show the value/status, source period where relevant, and last
  refresh time when known.
- Not configured: explain which capability is unavailable without revealing
  server configuration details.
- Not available: distinguish unsupported data from a zero balance or zero use.
- Error: keep the rest of General usable and offer Retry for the affected card.

## Acceptance Criteria

- Ministries and Servant Groups remain editable from General.
- AI usage and credit labels do not present inferred values as authoritative.
- Access Control contains no user-management controls in 1.1.
- Integration status reveals no credential material.
- General stays directly related to worship preparation and production tools.

## Out of Scope

- Church organization registration.
- Individual account creation or invitations.
- Role-based access control.
- Provider credential entry in the browser.
- OpenAI account connection or credit purchasing.
- General-purpose third-party integration marketplace.

## Review Decisions

- [ ] Confirm status-only Access Control for 1.1.
- [ ] Confirm status-only AI Integrations for 1.1.
- [ ] Confirm `Not available` is acceptable when provider credit balance cannot
  be retrieved reliably.

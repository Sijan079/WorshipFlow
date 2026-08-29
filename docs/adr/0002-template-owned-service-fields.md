# ADR-0002: Template-Owned Service Fields

## Status

Accepted

## Context

Churches prepare worship services with materially different program flows.
Shared Program Block Types forced template blocks to depend on an
workspace-wide library, making an imported or custom flow difficult to adapt.

## Decision

- Each ordered `ServiceTemplateBlock` owns its field definition and defaults.
- Creating a service copies the active template blocks, definitions, defaults,
  and stored order into `WorshipServiceBlock` rows in one transaction.
- Draft services may have incomplete required fields. Moving a service to
  `READY` validates the copied service-block definitions, not the current
  template.
- Legacy Program Block Types remain a read fallback for existing records only;
  newly edited templates do not require them.
- Platform starter templates are seeded as workspace-owned copies. A church can
  alter or delete its copy without changing another church’s setup.

## Consequences

- Template changes cannot rewrite historical service forms or values.
- Templates support different church traditions without a global required
  lineup.
- The migration snapshots existing type-version definitions into current
  template and service blocks. It preserves field values and stored order.
- Shared publishing is intentionally limited to platform-managed starter
  definitions; churches do not publish into each other’s workspaces.

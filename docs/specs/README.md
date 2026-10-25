# Specs

Use the [document map](../map.md) to pick a spec and the
[current state](../current-state.md) to check whether its behavior is implemented.
Older specs may preserve decisions or proposals that have since changed.

Version-controlled feature specs live here.

- [Events foundation](./events/spec.md) records the current calendar-first
  event surface and its deferred workflows.
- [Live outputs](./live-outputs/spec.md) records the current Sermon Captions
  flow, viewer states, access model, and caption retention. The Settings
  provider-usage view and its limits are explained in
  [the viability note](../planning/sermon-captions-usage-settings-viability.md).
- [Mobile usability and reliable interaction states](./mobile-usability/spec.md)
  records the September 20, 2026 all-pages source audit and phased acceptance criteria.

Each feature should have a dedicated folder with at least:

- `spec.md` - current product and implementation contract.
- future version files when behavior changes materially.

Media Tools are split by individual tool so each workflow can evolve without
blurring ownership. The active tool index is in
[`media-tools/spec.md`](./media-tools/spec.md).

Accepted cross-feature decisions live in [`../adr/`](../adr/).

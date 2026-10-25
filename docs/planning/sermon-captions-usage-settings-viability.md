# Sermon Captions usage view: viability research

Researched 2026-10-25. The first Settings Usage slice described below is now
implemented. Azure resource-wide reconciliation and automatic cutoff remain
future decisions.

The October 2026 Azure Monitor export for Angeles City Bible Church covers
October 1 00:00 to October 25 19:54:44 Asia/Manila and totals 8,538 text
characters. The app ledger had no rows when this dated resource baseline was
imported. The Usage tab now adds later app-metered characters to it; this is
an estimate if the resource is used outside WorshipFlow after the export.
The configured Deepgram Admin key returned a USD project balance through the
billing API. Its response includes no credit-type field, so the UI does not
split promotional and purchased credit.

## Decision to support

Before a service, a workspace Owner or Admin should be able to see whether the
caption providers have enough allowance for the planned broadcast. The first
pilot has one member viewing a text-only link for one service at a time. The
current viewer URL is unique to a caption session, stays stable across booth
reconnections, and serves its last ten lines for one hour after Stop. Anyone
with that URL can read it; it is not an account-restricted invitation. A
permanent cross-service viewer URL has not been chosen or implemented.

The proposed Settings view should show provider data separately and label its
source and last refresh time. It should help the team decide when to limit
testing; it must not silently stop captions during a service based on an
estimate or delayed balance.

## Provider findings

| Question | Finding | Implication for WorshipFlow |
| --- | --- | --- |
| Deepgram credit balance | `GET /v1/projects/{project_id}/balances` returns a list of balance amounts and units. Deepgram describes them as outstanding project balances. | A server-side Settings read can show the returned balances, with their units and retrieval time. Do not assume one balance row, sum unlike units, or treat a displayed number as a guaranteed spendable amount during an active stream. |
| Deepgram authorization | Deepgram's documented `member` project role has `usage:read` but not `billing:read`; `admin` and `owner` have `billing:read`. | The existing Member-level key used for temporary streaming tokens should stay limited. A separate server-only credential with `billing:read` (and `usage:read` if usage is also shown) is needed for the balance API. Confirm its permissions against the actual project before building the view. |
| Deepgram consumption | Deepgram offers project usage APIs and console reports. Its older `GET /usage` reference is marked deprecated and points to a usage-breakdown API. | Balance is the useful first number. If a consumed-hours or spend chart is added, verify the current breakdown endpoint and its response with the project before choosing fields. It will be project-wide unless requests are tagged or otherwise partitioned. |
| Azure characters for each request | Translator v3 documents the `X-metered-usage` response header as the number of charged characters for a translation request. Current `translateCaption` returns only translated text and does not retain this header. | Capture this header on successful calls and persist a workspace-scoped count with the caption session or a small usage ledger. This can show WorshipFlow-attributed usage from the day tracking begins without Azure management credentials. Reconcile missing or invalid headers explicitly; do not invent zero usage. |
| Azure monthly allowance | The F0 pricing page lists 2 million characters per month for standard translation and custom translation training combined. Translator counts submitted source text, including spaces and punctuation, and counts each target translation separately. | Show an allowance and remaining estimate only after the operator confirms the resource is F0 and the billing period. An app-side count excludes use before tracking starts, use by other apps, and any custom training on the same resource. Label it an estimate, not Azure's official remaining quota. |
| Azure resource-wide usage | Azure documents `TextCharactersTranslated` as a resource metric, queryable through Azure Monitor Metrics with Azure identity and Monitoring Reader access. | This could reconcile app-side counts with the whole resource. The Translator subscription key and region alone cannot authorize Azure Monitor. Microsoft support reports that detailed character metrics may be unavailable for F0 resources; verify the actual resource before relying on it. |

Sources: [Deepgram balances](https://developers.deepgram.com/reference/manage/billing/list),
[Deepgram roles and scopes](https://developers.deepgram.com/guides/deep-dives/working-with-roles),
[Deepgram usage](https://developers.deepgram.com/docs/using-logs-usage),
[deprecated Deepgram usage reference](https://developers.deepgram.com/reference/manage/usage/get),
[Azure Translate response headers](https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/reference/v3/translate),
[Azure Translator character counting](https://learn.microsoft.com/en-us/azure/ai-services/translator/faq),
[Azure F0 pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/translator/),
[Azure resource metrics](https://learn.microsoft.com/en-us/azure/azure-monitor/reference/supported-metrics/microsoft-cognitiveservices-accounts-metrics),
[Azure Monitor Metrics API](https://learn.microsoft.com/en-us/rest/api/monitor/metrics/list?view=rest-monitor-2023-10-01),
[Azure Monitor permissions](https://learn.microsoft.com/en-us/azure/azure-monitor/platform/rest-api-walkthrough),
[Microsoft F0 support discussion](https://learn.microsoft.com/en-us/answers/questions/5817839/on-azure-translate-resource-i-cannot-see-the-trans).

## Implemented first slice

The **Usage** tab under Settings → Connections is at
`/w/{workspaceSlug}/settings?tab=usage`, visible only to Owner/Admin. It
contains a **Sermon Captions** section for Deepgram and Azure; this does not
imply usage reporting for unrelated modules. The usage API is server-side and
workspace-authorized. It shows:

1. Deepgram project balance, currency or units, and last successful refresh.
   If a billing-read credential has not been configured, show a link to the
   Deepgram Console instead of a fabricated zero.
2. Azure characters attributed to WorshipFlow this UTC calendar month, based
   on stored `X-metered-usage` values; show the tracking start date. An F0
   percentage is deferred until the actual resource tier and billing period
   are confirmed.
3. A short note when data is unavailable or incomplete. The team can set a
   manual testing budget; this view does not enforce a mid-service cutoff.

Keep provider credentials on the server. Because the current provider keys are
environment-level, provider balances are global to those keys, while the
proposed Azure app ledger can be workspace-scoped. If several workspaces later
share the same keys, the UI must identify this difference clearly.

## Alternatives and why they are later

- **Azure Monitor only:** covers the resource beyond WorshipFlow, but needs an
  Azure identity, resource ID, and Monitoring Reader role, and F0 character
  metric availability is uncertain. Use it for reconciliation after checking
  the actual Azure resource.
- **Estimate from source text length:** quick to add, but less authoritative
  than the metered header and prone to mistakes with multi-target requests and
  retries. Use only as a labeled fallback when no metered value is returned.
- **Automatic hard cap:** could interrupt accessibility captions during a live
  service based on delayed or incomplete data. Defer until the church has a
  policy for what should happen at a limit.

## Further provider verification

- Check whether the Deepgram project balance response includes the trial credit
  in this account and whether a narrowly scoped `billing:read` key can be issued.
- Check the actual Azure resource tier, monthly billing boundary, and whether
  `TextCharactersTranslated` appears for it in Azure Monitor.
- Confirm that `X-metered-usage` is present on the app's current Translator v3
  requests and whether all translation paths use the same resource.
- Choose where usage records belong in Prisma, how retries avoid duplicate
  accounting, and whether older usage from outside WorshipFlow needs display.

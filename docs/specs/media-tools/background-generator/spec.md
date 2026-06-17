# Background Generator Spec

## Purpose

Background Generator creates worship-presentation backgrounds for sanctuary
projection and service preparation.

The tool is for worship-service media only. It should not become a general AI
art studio, social content generator, stock asset marketplace, or permanent
church media archive.

## Scope

- Generate still image backgrounds for worship presentation use.
- Default all generations to landscape 16:9.
- Use OpenAI image generation through a server-only provider adapter.
- Show the provider-selected presentation resolution in the estimate before
  generation.
- Support structured prompt controls for worship-production intent:
  - Purpose: Lyrics, Sermon, Scripture, Offering, Announcements, General Worship.
  - Mood: Reverent, Joyful, Reflective, Hopeful, Quiet, Celebration.
  - Visual style: Abstract light, soft landscape, stained glass, minimal
    texture, warm stage wash, atmospheric clouds.
  - Text safe area: Center clear, lower-third clear, full-frame background.
  - Optional prompt details.
- Treat every generated background as a workspace asset.
- Persist generated files as generated outputs, not transient UI-only blobs.
- Provide preview and download actions for completed outputs.
- Reset Mood and Visual Style after each successful generation.
- Auto-delete generated backgrounds after 24 hours.
- Keep only the 10 most recent generated backgrounds visible in the shelf.

## Out Of Scope For V1

- Batch generation.
- Public sharing links.
- Generic prompt-only image generation without worship-production controls.
- Long-term asset-library management.
- Direct insertion into presentation software.
- Generated backgrounds for non-worship church events.
- Video generation. This remains disabled until a replacement provider is chosen.
- Worship service selection or optional service association inside the generator.

## Default Format

The default format is `Presentation 16:9`.

The UI should describe the format as presentation/projection-oriented instead of
exposing only raw pixels. The estimate surface should show the actual provider
resolution returned by the server for that request.

## Provider Strategy

The active image provider is OpenAI image generation.

Video generation is intentionally disabled in the current workflow. If video is
reintroduced later, it should use a separate provider adapter and remain hidden
from the UI until the contract, cost model, and rate limits are defined.

Provider-specific code must stay behind a server-only adapter so the app can add
or replace providers later without changing the UI contract.

Recommended internal boundary:

- `src/features/media-generation/server/provider.ts`
- `src/features/media-generation/server/openai-background-provider.ts`
- `src/features/media-generation/media-generation-types.ts`

The provider adapter should receive a normalized generation request and return a
normalized result containing file bytes, MIME type, provider metadata, and any
reported usage.

## Cost And Token Confirmation

Every generation must show a preflight estimate before the provider call.

The estimate should include:

- Provider.
- Model.
- Media type.
- Format and selected provider resolution.
- Estimated input tokens or provider usage, when available.
- Estimated output tokens or provider usage, when available.
- Estimated cost in USD, when available.
- Pricing source or pricing snapshot date.
- A warning when free-tier availability cannot be guaranteed.

The user must explicitly confirm the estimate before generation starts.

The server must recalculate the estimate before calling the provider. The client
must not be trusted to provide the accepted cost.

After generation completes, the job should store:

- Accepted estimate.
- Actual provider usage when returned by the provider.
- Final estimated cost when actual usage is unavailable.
- Provider response metadata needed for troubleshooting.

## Data Persistence

Generated backgrounds should use the existing automation and generated-output
direction.

Expected schema direction:

- Add `BACKGROUND_IMAGE_GENERATE` to `JobType`.
- Add `BACKGROUND_IMAGE` to `OutputType`.
- Store request details, estimate, provider, model, and status in
  `AutomationJob.inputJson` and `AutomationJob.outputJson`.
- Store the generated file path in `GeneratedOutput.filePath`.

Generated files should be stored through the private output storage path and
downloaded through server routes. They should not be written into `public/`.
Production deployments should use the Supabase-backed private storage path for
generated backgrounds and PAP temporary assets.

## API Shape

Recommended endpoints:

- `POST /api/media/backgrounds/estimate`
- `POST /api/media/backgrounds/generate`
- `GET /api/media/backgrounds`
- `GET /api/media/backgrounds/[outputId]/download`

The estimate route validates the request and returns a server-calculated
estimate.

The generate route validates the request again, recalculates the estimate, checks
limits, creates an automation job, calls the provider, stores the generated file,
creates the generated output, and returns the completed job/output summary.

The list route should also trigger background-output retention cleanup before
returning the 10 most recent image outputs for the active workspace.

## Security And Abuse Controls

AI media generation is cost-bearing and should be treated as an abuse-sensitive
workflow.

Required controls:

- Server-side validation with Zod.
- Server-only API keys.
- No provider keys exposed to the browser.
- Per-workspace and per-client rate limits.
- Daily generation cap.
- Max prompt length.
- Structured prompt fields with a constrained optional freeform note.
- Explicit cost confirmation before each generation.
- Server-side estimate recalculation before provider calls.
- Provider timeout handling.
- Failed-job persistence for auditability.
- Clear handling for quota exhaustion and provider rate-limit errors.
- No automatic retries that can multiply cost without user confirmation.

Recommended starting limits:

- 5 image generations per workspace per hour.
- 25 image generations per workspace per day.
- 1 in-flight generation per workspace.
- 500 characters for optional prompt details.

The limits should be configurable by environment variables so hosted deployment
and local-first desktop builds can use different policies.

## Prompt Safety

The generated prompt should always include worship-production constraints:

- No text.
- No logos.
- No identifiable people.
- No celebrity or public-figure likeness.
- No copyrighted characters.
- No political campaign imagery.
- No violent, sexual, or manipulative content.
- Keep the visual calm enough for lyrics or scripture overlays.

The UI should guide users toward safe, reusable projection backgrounds rather
than photorealistic people, branded content, or event-poster generation.

## UI Requirements

The page should follow the Production Grade Interface design system:

- Persistent workspace shell.
- Compact, inspector-style controls.
- Dark production surface.
- Purple primary action.
- Etched inputs with purple focus treatment.
- 8px default radius.
- High-contrast preview area.

The first screen should be the actual generator tool, not a landing page.

Expected layout:

- Page shell with a swiping workflow window.
- Three workflow stages: Data Entry, Estimation, and Output.
- Data Entry stage with purpose, mood, style, safe area, and optional details.
- Estimation stage with provider, model, resolution, and estimated cost.
- Output stage with full preview, download action, and process reset action.
- Recent outputs shelf showing the 10 most recent generated images.
- Preview modal opened from recent outputs, with:
  - large image preview
  - lorem ipsum overlay preview
  - black/white overlay text toggle
  - bottom download action

Behavior requirements:

- Mood and Style are required before estimate validation.
- Mood and Style are cleared after each successful generation.
- While generation is in progress, users cannot return to Data Entry.
- Download actions should show a visible loading state while the browser waits
  for the file response.

## Testing Notes

Tests should cover:

- Validation rejects unsupported formats, prompt overflow, and invalid service
  IDs.
- Validation rejects video requests because video is currently disabled.
- Estimate calculation is server-owned.
- Generate route refuses requests without accepted confirmation.
- Rate limits block excessive requests before provider calls.
- Provider errors create failed jobs without generated outputs.
- Successful generation creates one automation job and one generated output.
- Private output storage handles both legacy filesystem paths and active
  Supabase-backed paths.
- Background retention expires generated image outputs after 24 hours.

Provider calls should be mocked in route and service tests.

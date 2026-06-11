# Background Generator Spec

## Purpose

Background Generator creates worship-presentation backgrounds for sanctuary
projection and service preparation.

The tool is for worship-service media only. It should not become a general AI
art studio, social content generator, stock asset marketplace, or permanent
church media archive.

## Scope

- Generate still image backgrounds for worship presentation use.
- Generate short worship background video loops for presentation use.
- Default all generations to landscape 16:9.
- Prefer 1920x1080 output when the selected provider supports it.
- If exact 1920x1080 is unavailable, select the closest supported 16:9
  landscape format and show that provider resolution before generation.
- Default v1 video generation to 480p 16:9 because the target projector does not
  require high-resolution output.
- Support structured prompt controls for worship-production intent:
  - Purpose: Lyrics, Sermon, Scripture, Offering, Announcements, General Worship.
  - Mood: Reverent, Joyful, Reflective, Hopeful, Quiet, Celebration.
  - Visual style: Abstract light, soft landscape, stained glass, minimal
    texture, warm stage wash, atmospheric clouds.
  - Text safe area: Center clear, lower-third clear, full-frame background.
  - Optional prompt details.
- Optionally associate a generation with a `WorshipService`.
- Persist generated files as generated outputs, not transient UI-only blobs.
- Provide preview and download actions for completed outputs.
- Limit all video generations to exactly 15 seconds in v1.
- Require video generations to be suitable for seamless looping behind songs.

## Out Of Scope For V1

- Batch generation.
- Public sharing links.
- Generic prompt-only image generation without worship-production controls.
- Long-term asset-library management.
- Direct insertion into presentation software.
- Custom video duration.
- Generated backgrounds for non-worship church events.

Video generation is included in v1 only as a constrained 15-second seamless-loop
worship background mode. It should require explicit cost confirmation, hard rate
limits, and clear provider quota/error handling.

## Default Format

The default format is `Presentation 16:9`.

For images, the preferred output is 1920x1080. The UI should describe the format
as presentation/projection-oriented instead of exposing only raw pixels.

For video mode, the default duration is exactly 15 seconds and the default
quality is 480p 16:9. Higher resolutions are out of scope for v1 unless the user
explicitly revisits projector capability and cost expectations.

Video outputs are intended for repeated playback behind songs. The generated
prompt must request a seamless loop with matching first and final frames, subtle
continuous motion, and no visible beginning or ending.

## Provider Strategy

The first provider may be Google Gemini image generation, including the public
"Nano Banana" family where available through the official API.

Provider-specific code must stay behind a server-only adapter so the app can add
or replace providers later without changing the UI contract.

Recommended internal boundary:

- `src/features/media-generation/server/provider.ts`
- `src/features/media-generation/server/gemini-background-provider.ts`
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
- Video quality, defaulting to 480p when media type is video.
- Video duration when media type is video.
- Seamless-loop requirement when media type is video.
- Estimated input tokens or provider usage, when available.
- Estimated output tokens or provider usage, when available.
- Per-second video rate when media type is video and the provider bills that
  way.
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
- Add `BACKGROUND_VIDEO_GENERATE` to `JobType`.
- Add `BACKGROUND_IMAGE` to `OutputType`.
- Add `BACKGROUND_VIDEO` to `OutputType`.
- Store request details, estimate, provider, model, and status in
  `AutomationJob.inputJson` and `AutomationJob.outputJson`.
- Store the generated file path in `GeneratedOutput.filePath`.

Generated files should be stored through the private output storage path and
downloaded through server routes. They should not be written into `public/`.

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
- 1 video generation per workspace per hour.
- 3 video generations per workspace per day.
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

For video, generated prompts should additionally request a seamless 15-second
loop, matching first and final frames, subtle continuous motion, no camera cuts,
no flashing, no rapid motion, and no hard transitions so the output remains
usable behind lyrics or service information.

The app should label provider output as "loop-intended" rather than guaranteed
perfect when the provider cannot technically guarantee a seamless loop. The
preview should use repeat playback so users can visually check the loop point
before downloading.

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

- Left or top control panel for format, purpose, mood, style, safe area, and
  optional details.
- Media type segmented control for Image or 15-second 480p Video.
- Estimate panel with token/cost validation.
- Generate button disabled until a valid estimate is accepted.
- Preview area for the latest generated background, with looped playback for
  video.
- Recent outputs list with download actions.

## Testing Notes

Tests should cover:

- Validation rejects unsupported formats, prompt overflow, and invalid service
  IDs.
- Validation rejects any v1 video duration other than 15 seconds.
- Video prompt building includes seamless-loop requirements.
- Estimate calculation is server-owned.
- Generate route refuses requests without accepted confirmation.
- Rate limits block excessive requests before provider calls.
- Provider errors create failed jobs without generated outputs.
- Successful generation creates one automation job and one generated output.

Provider calls should be mocked in route and service tests.

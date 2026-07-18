# Resize Image Spec

## Purpose

Resize Image prepares church-owned screenshots and service graphics for a phone
or tablet screen. Processing and export happen locally in the browser; files
are not uploaded or persisted by WorshipFlow.

This tool is distinct from the disabled generic Media Converter. It accepts
only a file the operator selects from their device and does not download,
extract, or convert third-party media.

## Workflow

1. Upload or paste one PNG, JPEG, or WebP image.
2. Optionally detect and remove unused borders.
3. Select a device preset or enter custom dimensions.
4. Select portrait or landscape orientation.
5. Choose Fit, Fill, Stretch, or Blurred Background.
6. Preview and export as PNG, JPEG, or WebP.

Preview and export must use the same transformation calculations. Preview may
render at a lower resolution for responsiveness; the exported image must match
the target pixel dimensions.

Clipboard paste uses the same validation and decoding path as file upload.
Text-only clipboard content must keep its normal browser behavior.

When trim is active, the detected content bounds define the source crop and the
output height follows the selected output width at the cropped aspect ratio.

## Presets

- Xiaomi Redmi Note 10 5G
- iPad 10.2-inch
- iPad 10.9-inch
- iPad Air 11-inch and 13-inch
- iPad Pro 11-inch and 13-inch
- Generic 1080 × 1920, 1080 × 2160, 1080 × 2340, 1080 × 2400, and 1440 × 3200
- Custom width and height

Preset data lives separately from transformation logic so a device can be
added without changing the renderer.

## Fitting

- **Fit** preserves the full image and fills unused space with transparent,
  solid, black, white, or blurred-image background.
- **Fill** covers the target while preserving aspect ratio. Zoom and normalized
  horizontal and vertical positions control the crop; the preview also supports
  drag repositioning.
- **Stretch** fills the exact target and warns that distortion may occur.
- **Blurred Background** places a sharp fitted image over a darkened, blurred
  cover image.

## Validation and limits

- Accepted MIME types: `image/png`, `image/jpeg`, `image/webp`
- Maximum source file size: 20MB
- Minimum target side: 64px
- Maximum target width or height: 10,000px
- Maximum source or target area: 40,000,000 pixels
- JPEG and WebP quality is configurable.
- Transparent output requires PNG; other formats fall back to black with a
  visible warning.

Unreadable images, unsupported types, unsafe dimensions, unavailable canvas,
and failed exports must produce user-readable errors.

## Enhancement

`none`, `screenshot`, and `photo` modes use high-quality browser canvas
resampling. Screenshot and photo modes apply restrained contrast/color
adjustments. Edge-aware sharpening and noise reduction are deferred until
browser profiling shows that they improve text without making interaction
noticeably slower.

## Architecture

- `src/lib/device-presets.ts` owns device metadata.
- `src/lib/resize-image.ts` owns dimensions, validation, filenames, and shared
  transformations.
- `src/components/resize-image-tool.tsx` owns local UI state, browser decoding,
  preview, and export.

No Sharp server route, Web Worker, persistence layer, or shared state store is
part of this version. Add a worker only if measured interaction time shows that
large supported images block the UI.

## Acceptance

- Redmi Note 10 5G and each listed iPad can export in both orientations.
- Upload and clipboard paste accept the same supported image types and limits.
- Automatic trim removes unused borders and preserves the detected content
  aspect ratio.
- Custom dimensions reject non-integers and unsafe pixel counts.
- Fit preserves the complete source.
- Fill covers the target and supports zoom, sliders, reset, and drag.
- Stretch exports exact dimensions with a warning.
- Blurred Background keeps the complete source sharp.
- Exported filenames are sanitized and include target and orientation.
- Transformation and validation unit checks, lint, type checking, and build
  pass.

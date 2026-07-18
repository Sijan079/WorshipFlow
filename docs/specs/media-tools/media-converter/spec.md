# Media Converter Spec

## Status

Disabled for the deployed web app.

## Reason

The web app should not ship a generic media converter that could imply
downloading, extracting, or transforming media from third-party services in ways
that may conflict with their terms.

## Future Direction

Any future converter should be local-first, rights-aware, and explicitly scoped
to files the church is allowed to process. A future Tauri/Rust desktop adapter
is a better fit than a hosted web workflow.

The browser-based [Resize Image](../resize-image/spec.md) tool is not this
generic converter. It only resizes an operator-selected local image and does
not fetch, extract, or persist third-party media.

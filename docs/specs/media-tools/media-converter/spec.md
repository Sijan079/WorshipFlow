# Media Converter Spec

## Purpose

Media Converter prepares media files for projection, playback, and archive
handoff.

## Scope

- Add files.
- Select target output format.
- Show conversion queue and progress.
- Convert all queued files.

## Notes

This tool is currently UI-first. Real conversion should be implemented behind an
adapter so future Tauri/Rust or local-first processing can replace web-only
behavior.

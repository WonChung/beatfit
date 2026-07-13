# BeatFit documentation

This directory contains provider architecture and build guidance. Application
setup and component-specific documentation stays beside the code it describes.

## Application guides

- [Repository setup and CI](../README.md)
- [Expo mobile application](../apps/mobile/README.md)
- [Mobile exercise visual assets](../apps/mobile/assets/exercises/README.md)
- [Next.js web application](../apps/web/README.md)
- [FastAPI backend, database, and API](../backend/README.md)
- [Security policy](../.github/SECURITY.md)

## Music-provider guides

- [Apple Music architecture and phased design](apple-music-plan.md)
- [Apple Music Phase A/B manual configuration](apple-music-build-setup.md)
- [Spotify metadata integration](spotify-integration.md)

On completed platform adapters, Apple Music and Spotify provide authorization,
playlist or library metadata, artwork, duration, and track selection for
workout generation. The Apple Music Android native bridge remains backlog work.
Playback, beat analysis, BPM detection, and playback-state synchronization are
outside the implemented scope.

## Documentation maintenance

When behavior changes:

1. Update the README closest to the changed code.
2. Update the root README when setup, commands, environment variables, or the
   cross-platform product surface changes.
3. Update provider documents when dashboard configuration, scopes, redirect
   URIs, token handling, or platform limitations change.
4. Keep real credentials, access tokens, signing keys, database URLs, and user
   data out of examples and screenshots.
5. Verify every documented command against the corresponding package script,
   Make target, or backend tool before merging.

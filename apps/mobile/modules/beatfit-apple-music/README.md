# BeatFit Apple Music module

This local Expo module provides Apple Music authorization and library metadata
on iOS 16 and newer. It does not implement music playback, queue control, audio
analysis, or workout synchronization.

The supported native implementation is Apple-only. Android Apple Music remains
disabled because its authentication SDK is a separately licensed Apple
Developer download and the repository does not contain a complete bridge. Never
commit that SDK's AAR or Apple signing material.

Expo Go cannot load this module. Use an iOS development or production build with
the MusicKit capability configured for `com.beatfit.mobile`. A JavaScript export
does not compile or validate this Swift source.

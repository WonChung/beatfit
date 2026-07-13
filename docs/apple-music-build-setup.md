# Apple Music Phase A/B build setup

No Apple signing material belongs in the mobile or web projects. Complete the
server and platform configuration below before enabling the feature flags.

## Apple Developer portal

1. Register the Media ID configured as `APPLE_MUSIC_MEDIA_ID`; enable MusicKit.
2. Create a Media Services key associated with that Media ID. Record the Team ID
   and Key ID, download the `.p8` once, and import it into the backend secret
   manager. Do not copy it into this repository or an EAS environment exposed to
   the client bundle.
3. Register the explicit iOS App ID `com.beatfit.mobile` (or replace it with the
   final production identifier in `app.json`), enable the MusicKit App Service,
   and regenerate its provisioning profiles.
4. Add production and approved development web origins to
   `APPLE_MUSIC_WEB_ORIGINS`. MusicKit does not use a BeatFit OAuth callback.

## Backend

Copy the `APPLE_MUSIC_*` values from `backend/.env.example`. Mount the `.p8` as a
read-only runtime secret and point `APPLE_MUSIC_PRIVATE_KEY_PATH` to it. Apply
Alembic migration `20260713_0002` to preserve artwork and provider identifiers.

Only FastAPI signs ES256 developer tokens. The browser and native app receive a
short-lived signed token, never the private key, Team signing material, or raw
Music User Token.

## iOS development build

The local Expo module uses MusicKit for authorization, subscription checks,
library playlists, tracks, durations, and artwork. `app.json` supplies the
bundle ID and `NSAppleMusicUsageDescription`.

```bash
cd apps/mobile
npx expo prebuild --clean
npx expo run:ios --device
```

Use a signed physical device with an Apple Music account. Inspect the generated
provisioning profile and signed entitlements to confirm the App ID's MusicKit
service. Expo Go cannot load this module.

## Android development build

Download the current official MusicKit Authentication SDK from Apple Developer
and place its approved AAR dependencies under:

```text
apps/mobile/modules/beatfit-apple-music/android/libs/
```

Apple does not distribute this SDK through npm. Verify its license and the final
merged manifest. The checked-in bridge implements Apple's Activity-result token
flow and keeps the Music User Token in native process memory only; reconnect is
required after process death. It never substitutes a WebView or stores the token
in AsyncStorage. A future hardening pass may use Keystore-backed encrypted
storage after the exact token lifecycle for the selected SDK release is verified.

```bash
cd apps/mobile
npx expo prebuild --clean
npx expo run:android --device
```

## Web

Set `NEXT_PUBLIC_APPLE_MUSIC_ENABLED=true`. MusicKit JS loads only in the
browser, requests a short-lived origin-restricted token from FastAPI, and lets
Apple manage subscriber authorization. Test on the production HTTPS origin as
well as the approved local origin.

## Manual acceptance

1. Sign in to BeatFit.
2. Connect Apple Music and handle denial/cancellation and non-subscriber states.
3. Confirm an empty library and empty playlist render useful messages.
4. Open a playlist, verify artwork/title/artist/duration, and ensure unavailable
   or durationless tracks cannot be selected.
5. Select multiple tracks and generate a workout; confirm one workout block per
   selected track and that artwork/provider identifiers survive the response.
6. Disconnect and verify personalized library UI is cleared.
7. Confirm no `.p8`, developer signing credential, or Music User Token appears
   in browser bundles, mobile bundles, logs, URLs, or API request bodies.

Playback, queue control, background audio, lock-screen controls, and timer/player
synchronization remain Phase C/D work and are not part of this build.

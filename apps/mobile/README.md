# BeatFit Mobile

BeatFit mobile is the Expo/React Native client for creating personalized,
music-length workouts. It supports authenticated workout generation, preview,
an interval player, completion feedback, saved workouts, history, preferences,
metadata-only music selection, and local exercise visuals and animations.

The checked-in application uses Expo SDK 57, React Native 0.86, React 19, Expo
Router typed routes, and TypeScript 6.

The app uses Expo Router with typed routes. Application routes live in
`src/app`, reusable UI in `src/components`, API and provider adapters in
`src/services`, typed state providers in `src/state`, and device persistence in
`src/storage`. After authentication, the app opens directly into BeatFit's
workout setup flow and uses stack routes for preview, playback controls, saved
workouts, history, settings, and music-provider selection.

## Prerequisites

- Node.js 22 and npm (the version used by repository CI)
- The BeatFit FastAPI backend running locally or at a reachable HTTPS URL
- A configured Supabase project for email/password authentication
- Xcode for an iOS simulator or local iOS development build
- Android Studio for an Android emulator or local Android development build

Use Expo Go for the core JavaScript workout flow when its bundled native modules
are sufficient. Apple Music requires BeatFit's custom native module and
therefore a development build; it is not available in Expo Go.

## Setup

From `apps/mobile`:

```bash
npm ci
cp .env.example .env.local
```

Update `.env.local`, start the backend, then start Expo:

```bash
npm start
```

The Expo terminal can open a simulator, emulator, web browser, Expo Go, or an
installed development build. The package scripts start Metro and request the
selected target; they do not compile a custom native development build:

```bash
npm run ios
npm run android
npm run web
```

From the repository root, `make setup` installs all project dependencies and
`make run-mobile` starts this app.

## Environment variables

Expo embeds every `EXPO_PUBLIC_` value in the client bundle. These values must
be public configuration, never credentials.

| Variable | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | Recommended | BeatFit backend origin. The client falls back to `http://127.0.0.1:8000` for local web and the iOS simulator. |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Public Supabase project URL used for authentication. |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable/anonymous client key. Never use a service-role key. |
| `EXPO_PUBLIC_APPLE_MUSIC_ENABLED` | No | Shows the Apple Music entry point when set to `true`; it does not make the native module available. |
| `EXPO_PUBLIC_SPOTIFY_ENABLED` | No | Shows the Spotify entry point when set to `true`. |
| `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` | For Spotify | Public Spotify application client ID used by Authorization Code with PKCE. |
| `EXPO_PUBLIC_SPOTIFY_REDIRECT_URI` | For Spotify | Redirect URI registered exactly in the Spotify Developer Dashboard and in the installed app build. |

Supabase configuration accepts an HTTPS origin, or loopback HTTP for a local
Supabase instance. Placeholder values, `sb_secret_` keys, and legacy
service-role JWTs are rejected. Missing or invalid values leave authentication
safely unconfigured so module imports and Expo exports can still complete; they
do not enable authentication. Production BeatFit API origins must still use
trusted HTTPS. Malformed, non-HTTP, credential-bearing, query-bearing, or
fragment-bearing API base URLs are discarded instead of being embedded in
requests.

Restart Expo after changing environment variables. Never put Supabase service
keys, Spotify client secrets, Apple private keys, Apple signing credentials, or
provider access tokens in `.env.local`.

## Local device networking

`127.0.0.1` on a physical phone is the phone itself, not the development Mac.
For a physical device, use the Mac's local network address:

```text
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.25:8000
```

Run FastAPI on `0.0.0.0`, keep both devices on the same network, and permit the
connection through the Mac firewall:

```bash
cd backend
.venv/bin/fastapi dev app/main.py --host 0.0.0.0
```

An Android emulator commonly reaches the host through
`http://10.0.2.2:8000`; confirm the address for the emulator in use. Production
builds must use a trusted HTTPS API origin.

## Authentication and protected routes

`AuthProvider` wraps the Expo Router stack. It restores the Supabase session
before rendering protected screens, refreshes tokens while the native app is
active, and exposes email/password sign-up, sign-in, and sign-out. The sign-in
screen is the only unauthenticated route; workout, provider, preferences,
saved-workout, history, and player screens are inside `Stack.Protected`.

On iOS and Android, Supabase session data is stored with `expo-secure-store`.
Apple keychain writes use the device-only, when-unlocked accessibility class.
The storage adapter checks protected storage first and performs a one-time
migration from the legacy AsyncStorage entry when needed. It removes the
unprotected entry only after the protected write succeeds; logout removes both
copies. Expo web keeps Supabase's browser storage behavior.

Authentication transitions also define the lifetime of account-owned client
state. The account boundary remounts workout, persistence, and preference state
when the authenticated user changes. Explicit logout and detected account
switches centrally disconnect Apple Music and Spotify state. Provider cleanup
is best-effort so a provider error cannot leave the Supabase session signed in.

Email confirmation follows the Supabase project's Auth settings. The mobile app
uses the public Supabase key only. Backend requests that need an account include
the current access token, and the backend derives ownership from the verified
token rather than a client-supplied user ID.

## Workout flow

1. **Setup** selects muscle group, difficulty, available equipment, goal, and
   either a manually entered song or provider-selected tracks.
2. **Generate** calls the authenticated
   `POST /workouts/generate/personalized` endpoint through the centralized API
   client. The generated workout and original request remain in typed in-memory
   state rather than being serialized into route parameters.
3. **Preview** shows configuration, personalization explanations, song blocks,
   every interval, and exercise silhouettes. A workout can be regenerated,
   edited, saved under a unique name, or started.
4. **Player** uses timestamp-based timer transitions, supports start, pause,
   resume, previous, skip, and confirmed early ending, and automatically moves
   through intervals and song blocks.
5. **Completion** summarizes planned and actual duration, completed intervals
   and blocks, status, and feedback. The user can repeat the same generated
   workout without another backend request.

Saved workouts can be renamed, favorited, repeated, or deleted. History includes
completed and ended-early sessions. Preferences are account-backed and include
difficulty, equipment, goal, avoided/favorite exercises, high-impact allowance,
and work/rest intensity; personalization can also be reset.

## State and persistence

- `WorkoutProvider` owns the current request, generated workout, selected songs,
  and active/completed session in memory.
- `PersistenceProvider` is mounted for the authenticated user and exposes local
  saved-workout and history operations for that account.
- `PreferencesProvider` loads and updates account preferences through the API.
- `BeatFitRepository` is the only layer that directly reads and writes workout
  data in AsyncStorage.

Each account uses an encoded, user-ID-scoped
`@beatfit/data/user/<user-id>` key. Its schema version is `1` and contains
`generatedWorkouts`, `savedWorkouts`, and `sessions`. Reads migrate the
version-0 shape within that account's store, discard malformed records, and
deduplicate IDs. Add future migrations to `migrateStorage` before increasing
`STORAGE_SCHEMA_VERSION`.

The old unscoped `@beatfit/data` entry is deliberately not read or imported:
its owner cannot be established safely. It remains quarantined from every
account instead of risking data exposure during an upgrade. Consequently,
workouts saved by older app versions are not automatically recovered into a
new account-scoped store.

Completed sessions and feedback attempt account sync when the generated workout
has a backend ID; local history remains available when sync fails. The current
workout repository remains unencrypted and device-local because it uses
AsyncStorage; it is separate from protected Supabase and provider credentials.

## Music metadata providers

Music integrations provide playlist and track metadata only: title, artist,
duration, artwork where available, and a provider identifier. Selected tracks
are converted into BeatFit's `Song` model and passed to workout generation.
Neither provider plays music or supplies BPM, audio analysis, recommendations,
or beat synchronization.

### Apple Music

The `AppleMusicService` interface is backed by a local Expo native module on
iOS. The module requests MusicKit authorization, checks subscription capability,
and reads library playlist/track metadata. The current screen loads the first
25 playlists and the first 25 tracks from a selected playlist even though the
service contract preserves Apple's next-page token. It requires:

- an Apple Developer identifier and MusicKit capability/entitlement;
- iOS 16 or newer, matching the local module podspec;
- the usage description already declared in `app.json`;
- a BeatFit development build or production native build.

Apple Music authorization and the device's Apple Music account remain
system-managed. BeatFit additionally stores a logical owner binding in
SecureStore. If the active BeatFit user does not match that binding, the adapter
clears its logical connection before returning library metadata. This prevents
one BeatFit account from inheriting another account's in-app provider state; it
does not change the device-level Apple authorization.

The local module is Apple-only and is not registered on Android. Expo Go cannot
load `BeatFitAppleMusic`, and the mobile app does not currently expose the
backend's public catalog-search endpoint as an Expo Go fallback. Apple private
keys and signing credentials must never be bundled in the client. See the
repository's
[`apple-music-build-setup.md`](../../docs/apple-music-build-setup.md) for the
manual Apple Developer and native-build checklist.

### Spotify

Spotify uses Authorization Code with PKCE, the two playlist-read scopes, and no
client secret. Access and refresh tokens are stored in SecureStore and bound to
the active BeatFit user. Configure the exact redirect URI and add test accounts
as development users in Spotify's dashboard while the application remains in
Development Mode. The default `mobile://spotify-callback` custom scheme is for
an installed app/development build, not Expo Go.

That custom scheme is suitable for local development but can be claimed by
another installed application. Before a production release, prefer a claimed
HTTPS universal/app link supported by the provider and register that exact URI.
The Expo linking configuration, environment value, installed binary, and
Spotify dashboard must agree whenever the redirect URI changes.

The adapter handles token refresh, pagination, cancellation, unavailable and
local tracks, missing scopes, network failures, and rate limits. Disconnecting
removes locally stored Spotify tokens and Spotify-selected tracks. See
[`spotify-integration.md`](../../docs/spotify-integration.md) for dashboard,
redirect, development-user, and release-limit details.

## Exercise visuals and animations

Exercise visuals are offline SVG assets under `assets/exercises`. The mapping in
`src/utils/exercise-visual.ts` normalizes names and aliases them to a small set of
typed posture keys. `src/components/exercise-visual.tsx` maps those keys to
static Metro `require()` calls and renders them with `expo-image`.

`ExerciseVisual` accepts an exercise name, size, optional label visibility, and
fallback behavior. Preview intervals use compact static thumbnails, and the
player uses a smaller static next-exercise visual. Unknown or blank names use
the bundled fallback silhouette and display the exercise name; callers can opt
to hide unknown visuals.

The player's current interval uses `ExerciseAnimation`. It prefers the stable
backend `exercise_id`, falls back to normalized legacy names, uses pose pairs
for push-ups, squats, and mountain climbers, shows a breathing cycle for rest,
and uses a generic movement cycle for unknown exercises. Pausing freezes
motion, reduced-motion preference selects a static pose, and warm-up/burnout
types adjust playback speed without changing the exercise asset.

The current ten assets are reusable posture placeholders, not exact
exercise-by-exercise form illustrations. See
[`assets/exercises/README.md`](assets/exercises/README.md) for the source table,
alias coverage, replacement workflow, accessibility requirements, and tests.
The [animation asset guide](assets/exercise-animations/README.md) documents the
pose registry and animation-specific workflow.

## Project layout

```text
apps/mobile/
├── assets/exercises/          local static SVG exercise silhouettes
├── assets/exercise-animations/ local SVG pose pairs for the player
├── modules/                   local Expo native modules
├── src/app/                   Expo Router routes and protected stack
├── src/components/            shared UI and error boundary
├── src/hooks/                 theme and workout timer hooks
├── src/services/              BeatFit API and music-provider adapters
├── src/state/                 auth, preferences, persistence, workout state
├── src/storage/               versioned local repository
├── src/timer/                 pure interval timeline/state transitions
├── src/types/                 shared mobile domain types
└── src/utils/                 validation, formatting, sessions, visuals
```

## Validation and builds

Run all mobile checks from `apps/mobile`:

```bash
npm run lint
npm run typecheck
npm test
npm run verify:native-module
npm run export:ios
```

Jest uses `jest-expo`, runs serially, and mocks native storage and provider
adapters; normal test runs do not require Apple Music, Spotify, Supabase, or a
real provider account. The suite covers protected-session migration and
cleanup, session restoration, logout and account switching, user-scoped workout
storage and legacy-data quarantine, and Apple Music logical-owner enforcement.

`verify:native-module` checks that the Apple Music module is available to the
Apple autolinking configuration and absent from Android. `export:ios` verifies
that Metro can bundle the iOS JavaScript and assets, including local SVGs, into
the ignored `dist` directory. To export every JavaScript target explicitly, use:

```bash
npx expo export --platform all --output-dir dist
```

An export does not compile native code. Build and run the relevant installed
app when testing Apple Music or custom OAuth URL handling:

```bash
npx expo run:ios
npx expo run:android
```

Apple Music itself must be validated with the iOS build; the Android command is
for the rest of the Android app and installed-app OAuth behavior.

## Known limitations

- There is no Apple Music or Spotify playback, audio analysis, or playback-state
  synchronization.
- Apple Music library access is Apple-only, requires iOS 16 or newer, and is
  unavailable on Android and in Expo Go. Mobile Apple library screens do not
  load subsequent pages or expose backend public catalog search.
- The active timer recalculates from wall-clock timestamps when foregrounded,
  but the JavaScript process does not execute reliably in the background.
  Haptics, UI updates, and completion navigation can be delayed until foreground.
- Workout persistence is local-first, is not a complete cross-device cache,
  and stores account-scoped workout data unencrypted in AsyncStorage on the
  device.
- Exercise silhouettes are generic static posture placeholders and do not yet
  demonstrate each exercise's full movement or form.

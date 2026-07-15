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
`src/storage`.

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
- `PersistenceProvider` exposes local saved-workout and history operations.
- `PreferencesProvider` loads and updates account preferences through the API.
- `BeatFitRepository` is the only layer that directly reads and writes workout
  data in AsyncStorage.

Local data uses the `@beatfit/data` key and schema version `1`, containing
`generatedWorkouts`, `savedWorkouts`, and `sessions`. Reads migrate the legacy
version-0 shape, discard malformed records, and deduplicate IDs. Add future
migrations to `migrateStorage` before increasing `STORAGE_SCHEMA_VERSION`.

AsyncStorage is unencrypted and device-local. The workout repository is not
partitioned by BeatFit user, so switching accounts on the same app installation
does not isolate locally generated workouts, saved workouts, or history. Treat
that store as single-user MVP data, clear app storage on a shared device, and
add an account-keyed migration before claiming multi-user local isolation.

Completed sessions and feedback attempt account sync when the generated workout
has a backend ID; local history remains available when sync fails. The current
Supabase React Native client also persists its auth session through
AsyncStorage. Replace that auth storage adapter with platform-protected storage
before treating native session tokens as production-hardened. Spotify tokens
already use SecureStore and are bound to the active BeatFit user.

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
- a BeatFit development build or production native build;
- a signed backend developer-token endpoint where the platform requires a
  developer token.

The private Apple key and signing credentials belong only on the backend. Expo
Go cannot load `BeatFitAppleMusic`, and the mobile app does not currently expose
the backend's public catalog-search endpoint as an Expo Go fallback. The Android
directory is a native integration scaffold that expects Apple's approved
MusicKit authentication AAR; its native module still needs completing before
the feature is usable there. See the repository's
[`apple-music-build-setup.md`](../../docs/apple-music-build-setup.md) for the
manual Apple Developer and native-build checklist.

### Spotify

Spotify uses Authorization Code with PKCE, the two playlist-read scopes, and no
client secret. Access and refresh tokens are stored in SecureStore and bound to
the active BeatFit user. Configure the exact redirect URI and add test accounts
as development users in Spotify's dashboard while the application remains in
Development Mode. The default `mobile://spotify-callback` custom scheme is for
an installed app/development build, not Expo Go.

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
```

Jest uses `jest-expo`, runs serially, and mocks AsyncStorage. Provider tests use
fixtures and mock adapters; normal test runs do not require Apple Music, Spotify,
Supabase, or a real provider account.

Verify Metro can bundle a platform, including all local SVGs, with:

```bash
npx expo export --platform ios --output-dir dist
```

Use `--platform android` or `--platform web` for another target. `dist` is a
generated, ignored directory. An export verifies the JavaScript/assets bundle;
it does not compile or validate custom native modules. Build and run the native
project when testing Apple Music or custom URL schemes:

```bash
npx expo run:ios
npx expo run:android
```

## Known limitations

- There is no Apple Music or Spotify playback, audio analysis, or playback-state
  synchronization.
- Apple Music is unavailable in Expo Go and its Android native adapter is not
  complete. Mobile Apple library screens do not load subsequent pages or expose
  backend public catalog search.
- The active timer recalculates from wall-clock timestamps when foregrounded,
  but the JavaScript process does not execute reliably in the background.
  Haptics, UI updates, and completion navigation can be delayed until foreground.
- Workout persistence is local-first, is not a complete cross-device cache,
  and is not partitioned by BeatFit account on a shared installation.
- Native Supabase sessions currently use AsyncStorage rather than a
  platform-protected storage adapter.
- Exercise silhouettes are generic static posture placeholders and do not yet
  demonstrate each exercise's full movement or form.
- The Explore tab still contains Expo-oriented reference content and is not a
  finished BeatFit product surface.

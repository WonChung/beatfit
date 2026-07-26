# BeatFit Web

BeatFit Web is the browser client for building song-duration workouts,
previewing generated intervals, running a timestamp-based workout timer, and
recording completion with optional difficulty feedback. The checked-in app uses
Next.js 16.2, React 19, TypeScript, cookie-backed Supabase authentication, and
FastAPI. Generation is rules-based rather than AI, and the app does not play or
synchronize music.

## What is implemented

- Email/password sign-up, sign-in, session refresh, and sign-out through Supabase.
- A protected dashboard with a server-side authentication check before account content is rendered.
- Workout setup for muscle group, difficulty, equipment, goal, and song metadata.
- Personalized workout generation through the authenticated BeatFit API.
- Contiguous interval timelines that end exactly at each song block's computed
  duration; the same inputs, personalization state, and `random_seed` reproduce
  exercise selection.
- An end-to-end browser flow: setup, generated interval preview, timestamp-based timer, and completion summary.
- Completion/session persistence and optional `too_easy`, `about_right`, or `too_hard` feedback.
- Account preferences for default difficulty, available equipment, preferred goal, avoided/favorite exercises, high-impact movements, and work/rest balance.
- Rule-based personalization details in the generated-workout preview.
- Optional Apple Music library metadata and client-side Spotify PKCE metadata import for selecting playlist tracks.
- ID-first exercise demonstrations with reduced-motion and off-screen pause behavior.
- Route-level and global error boundaries with safe user-facing fallback messages.

## Architecture

The project uses the App Router under `src/app`:

```text
src/
├── app/
│   ├── page.tsx                         # Public sign-up/sign-in page
│   ├── dashboard/page.tsx               # Protected workout dashboard
│   ├── dashboard/settings/page.tsx      # Protected preference settings
│   ├── auth/spotify/callback/page.tsx   # Spotify PKCE callback
│   ├── error.tsx                        # Route error boundary
│   └── global-error.tsx                 # Root error boundary
├── components/
│   ├── workout-app.tsx                  # Setup, preview, timer, and completion flow
│   ├── preferences-settings.tsx         # Personalization preferences
│   ├── apple-music-browser.tsx          # Apple Music library metadata UI
│   └── spotify-music-browser.tsx        # Spotify playlist metadata UI
├── lib/
│   ├── api.ts                           # Central typed FastAPI client
│   ├── timer.ts                         # Pure timer transitions and calculations
│   ├── completion.ts                    # Session/completion calculations
│   ├── exercise-animation.ts            # ID/name registry and motion policy
│   ├── supabase/                        # Browser/server Supabase clients and session refresh
│   ├── apple-music/                     # MusicKit JS adapter and test doubles
│   ├── spotify/                         # Spotify PKCE adapter and test doubles
│   └── music-provider/                  # Shared provider metadata types
├── proxy.ts                             # Next.js session-refresh proxy
└── types/workout.ts                     # API and workout domain types
```

The `/dashboard` route has two authentication gates. `src/proxy.ts` refreshes
the cookie-backed Supabase session and redirects anonymous requests, then the
dashboard Server Component checks the returned claims before rendering account
content. The browser sends the Supabase access token to protected FastAPI
endpoints. FastAPI verifies its signature, issuer, audience, expiry, and role
against Supabase JWKS, then derives ownership from the verified `sub` claim
rather than a browser-supplied user ID.

Workout generation, preferences, sessions, feedback, exercise data, and Apple Music developer-token issuance depend on the FastAPI service. The web app does not access PostgreSQL directly.

## Prerequisites

- Node.js 22 and npm (repository CI); the installed Next.js version requires at least Node 20.9
- A running BeatFit backend with its database migrated
- A configured Supabase project for account flows

Apple Music and Spotify accounts/configuration are optional. Keep both feature flags disabled for the core workout flow.

## Setup

From this directory:

```bash
npm ci
cp .env.example .env.local
```

From the repository root, `make setup` installs the backend, mobile, and web dependencies together. See the root README and `backend/README.md` for PostgreSQL, migrations, FastAPI, and Supabase JWT-verification setup.

## Environment variables

Copy `.env.example` to `.env.local` and replace placeholder values:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Browser-accessible FastAPI origin, for example `http://127.0.0.1:8000` locally. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable/anonymous key used by browser authentication. |
| `NEXT_PUBLIC_APPLE_MUSIC_ENABLED` | No | Set to `true` to show the Apple Music metadata browser. |
| `NEXT_PUBLIC_APPLE_MUSIC_DEFAULT_STOREFRONT` | Apple only | Fallback Apple Music storefront, such as `us`. |
| `NEXT_PUBLIC_SPOTIFY_ENABLED` | No | Set to `true` to show the Spotify metadata browser. |
| `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` | Spotify only | Public Spotify application client ID. |
| `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI` | Spotify only | Exact registered Spotify callback URL, normally `http://127.0.0.1:3000/auth/spotify/callback` locally. |

Every `NEXT_PUBLIC_` value is bundled into browser code and must be treated as public. Never place any of the following in this app or its environment:

- Supabase service-role keys or JWT signing secrets
- Apple Music `.p8` private keys or developer-token signing credentials
- Spotify client secrets
- Database URLs or passwords

Production builds validate the API and Supabase URLs, require a public
Supabase key, and reject modern `sb_secret_` keys and legacy service-role JWTs.
The CI build uses explicit non-secret, non-deployed build values so this
validation runs without access to a real application environment.

The Apple Music developer token is signed and returned by the authenticated FastAPI endpoint. Spotify uses Authorization Code with PKCE because a browser cannot safely hold a client secret.

For local browser access, the FastAPI CORS configuration must include `http://127.0.0.1:3000` (and `http://localhost:3000` if that hostname is used). Keep the web origin, API base URL, Supabase redirect URLs, and Spotify redirect URI consistent; `localhost` and `127.0.0.1` are distinct origins.

## Run and verify

```bash
npm run dev        # Development server at http://localhost:3000
npm run lint       # ESLint
npm run typecheck  # TypeScript without emitting files
npm test           # Vitest test suite
npm run build      # Production Next.js build
npm run start      # Serve an existing production build
```

The equivalent repository-root commands are `make run-web`, `make lint`, `make typecheck`, and `make test`.

## Workout and personalization flow

1. Sign in and open `/dashboard`.
2. Choose a muscle group, difficulty, allowed equipment, goal, and song duration, or import one or more tracks from an enabled provider.
3. BeatFit calls the authenticated personalized generation endpoint and displays every generated interval plus the rule-based personalization explanation.
4. Preview the workout, regenerate it, or start the basic timer.
5. Start, pause/resume, skip intervals, or end early. Intervals advance automatically.
6. Review the completion summary. BeatFit saves the session and can save optional difficulty feedback.
7. Use `/dashboard/settings` to update durable constraints or reset feedback-based personalization history.

Explicit constraints such as equipment, avoided exercises, high-impact preference, selected muscle group, and selected goal remain authoritative. Feedback changes are conservative and are explained in the preview when enough recent history exists.

## Music-provider scope

Both integrations are metadata-only. Selected tracks are converted to BeatFit
song metadata (title, artist, duration, artwork, and provider identifiers where
available) and passed to workout generation.

### Apple Music

- Uses MusicKit JS for user authorization and library playlist browsing.
- Obtains a short-lived developer token from the authenticated backend; signing keys stay server-side.
- Binds the logical MusicKit connection to the current BeatFit user in per-tab
  storage. Account switches, cross-tab sign-out, and explicit logout clear that
  binding and attempt to unauthorize inherited MusicKit state.
- Requires Apple Developer identifiers/keys and an active Apple Music subscription for library access.
- Currently renders the first 25 playlists and first 25 tracks from the selected playlist; adapter next-page tokens are not yet surfaced by the UI.
- Does not currently consume the backend's authenticated Apple catalog-search endpoint.
- Controlled by `NEXT_PUBLIC_APPLE_MUSIC_ENABLED`.

### Spotify

- Uses Authorization Code with PKCE entirely in the browser, with the scopes `playlist-read-private` and `playlist-read-collaborative`.
- Exchanges and refreshes tokens directly with Spotify and calls the Spotify Web API directly; FastAPI is not part of this flow.
- Stores the access/refresh token record in browser `sessionStorage`, associates it with the current BeatFit user, and refreshes tokens when needed.
- Availability depends on Spotify dashboard mode, allowlisting, account eligibility, and playlist access policy.
- Controlled by `NEXT_PUBLIC_SPOTIFY_ENABLED`.

Neither integration plays music. Spotify audio features, audio analysis, recommendations, BPM, beat detection, and beat-drop detection are also intentionally out of scope.

## Exercise demonstrations

The active workout interval renders `ExerciseAnimation`. Resolution prefers the
stable backend `exercise_id`, falls back to normalized names for older
snapshots, uses dedicated push-up, squat, and mountain-climber pose pairs,
shows a breathing cycle for rest, and uses a generic cycle for unknown
exercises. Static posture assets cover several additional registry entries.

CSS pauses motion when the timer is paused. The component also stops motion
while it is outside the viewport or the page is hidden and shows a static start
pose for `prefers-reduced-motion`. See the
[asset guide](public/exercise-animations/README.md) before changing the registry
or files.

## Testing

Vitest covers form validation, API failures, protected-route decisions, timer
state transitions, completion calculations, preferences, public configuration,
provider ownership/account switching, safe pagination, and mocked
music-provider behavior. Tests do not require real Supabase, Apple Music, or
Spotify accounts.

The GitHub Actions web job uses Node.js 22 and runs `npm ci`, a high-severity
dependency audit, lint, type checking, Vitest, and a production build. In the
same workflow, the backend job applies and checks Alembic migrations and runs
pytest against an isolated PostgreSQL database; the mobile job runs its audit,
lint, type checks, tests, native-module verification, and iOS export.

Before opening a pull request, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Current limitations

- There is no Apple Music or Spotify playback and no synchronization between a provider player and the workout timer.
- Apple Music library browsing currently stops after the first playlist and track page, and there is no public catalog-search UI.
- The web timer relies on an open browser tab; browser throttling, sleeping devices, or closing the page can interrupt a workout.
- Spotify tokens use per-tab browser session storage rather than durable server-side provider-token storage.
- Provider availability depends on external subscriptions, permissions, development-mode restrictions, and dashboard configuration.
- Authentication is email/password only; social sign-in is not implemented.
- The web UI records completed sessions and feedback but does not currently provide the mobile app's full saved-workout/history browsing experience.
- No hosted production deployment is claimed or documented by this repository.

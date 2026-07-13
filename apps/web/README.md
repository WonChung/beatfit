# BeatFit Web

BeatFit Web is the browser client for building music-length workouts, previewing the generated intervals, running a basic workout timer, and recording a completion with optional difficulty feedback. It is a Next.js 16 App Router application using React 19, TypeScript, Supabase authentication, and a FastAPI backend.

## What is implemented

- Email/password sign-up, sign-in, session refresh, and sign-out through Supabase.
- A protected dashboard with a server-side authentication check before account content is rendered.
- Workout setup for muscle group, difficulty, equipment, goal, and song metadata.
- Personalized workout generation through the authenticated BeatFit API.
- A complete in-browser flow: setup, generated interval preview, timestamp-based timer, and completion summary.
- Completion/session persistence and optional `too_easy`, `about_right`, or `too_hard` feedback.
- Account preferences for default difficulty, available equipment, preferred goal, avoided/favorite exercises, high-impact movements, and work/rest balance.
- Explainable personalization details in the generated-workout preview.
- Optional Apple Music and Spotify metadata import for selecting playlist tracks.
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
│   ├── supabase/                        # Browser/server Supabase clients and session refresh
│   ├── apple-music/                     # MusicKit JS adapter and test doubles
│   ├── spotify/                         # Spotify PKCE adapter and test doubles
│   └── music-provider/                  # Shared provider metadata types
├── proxy.ts                             # Next.js session-refresh proxy
└── types/workout.ts                     # API and workout domain types
```

The `/dashboard` route has two authentication gates. `src/proxy.ts` refreshes the cookie-backed Supabase session and redirects anonymous requests, then the dashboard Server Component verifies the returned JWT claims before rendering client-side account data. The browser sends the Supabase access token to protected FastAPI endpoints; ownership always comes from the backend's verified token, never from a browser-supplied user ID.

Workout generation, preferences, sessions, feedback, exercise data, and Apple Music developer-token issuance depend on the FastAPI service. The web app does not access PostgreSQL directly.

## Prerequisites

- Node.js 20.9 or newer (required by the installed Next.js version)
- npm
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
3. BeatFit calls the authenticated personalized generation endpoint and displays every generated interval plus the deterministic personalization explanation.
4. Preview the workout, regenerate it, or start the basic timer.
5. Start, pause/resume, skip intervals, or end early. Intervals advance automatically.
6. Review the completion summary. BeatFit saves the session and can save optional difficulty feedback.
7. Use `/dashboard/settings` to update durable constraints or reset feedback-based personalization history.

Explicit constraints such as equipment, avoided exercises, high-impact preference, selected muscle group, and selected goal remain authoritative. Feedback changes are conservative and are explained in the preview when enough recent history exists.

## Music-provider scope

Both integrations are metadata-first. Selected tracks are converted to BeatFit song metadata (title, artist, duration, artwork/provider identifiers where available) and passed to workout generation.

### Apple Music

- Uses MusicKit JS for user authorization and library playlist browsing.
- Obtains a short-lived developer token from the authenticated backend; signing keys stay server-side.
- Requires Apple Developer identifiers/keys and an active Apple Music subscription for library access.
- Controlled by `NEXT_PUBLIC_APPLE_MUSIC_ENABLED`.

### Spotify

- Uses Authorization Code with PKCE and the scopes `playlist-read-private` and `playlist-read-collaborative`.
- Stores the access/refresh token record in browser `sessionStorage`, associates it with the current BeatFit user, and refreshes tokens when needed.
- In Spotify Development Mode, only allowlisted users can connect, the application owner must meet Spotify's current account requirements, and playlist access can be restricted to playlists the user owns or collaborates on.
- Controlled by `NEXT_PUBLIC_SPOTIFY_ENABLED`.

Neither integration plays music. Spotify audio features, audio analysis, recommendations, BPM, beat detection, and beat-drop detection are also intentionally out of scope.

## Testing

Vitest covers form validation, API failures, protected-route decisions, timer state transitions, completion calculations, preferences, and mocked music-provider behavior. Tests do not require real Supabase, Apple Music, or Spotify accounts.

Before opening a pull request, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Current limitations

- There is no Apple Music or Spotify playback and no synchronization between a provider player and the workout timer.
- The web timer relies on an open browser tab; browser throttling, sleeping devices, or closing the page can interrupt a workout.
- Spotify tokens use per-tab browser session storage rather than durable server-side provider-token storage.
- Provider availability depends on external subscriptions, permissions, development-mode restrictions, and dashboard configuration.
- Authentication is email/password only; social sign-in is not implemented.
- The web UI records completed sessions and feedback but does not currently provide the mobile app's full saved-workout/history browsing experience.
- Production deployment, monitoring, and secret provisioning are configured outside this application.

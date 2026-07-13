# BeatFit Spotify Metadata Integration

Status: Phase A/B implemented (authorization and metadata only)  
Last reviewed: 2026-07-12

## Architecture and security

BeatFit's Expo and Next.js clients use Spotify's Authorization Code flow with
PKCE. Both are public clients: they generate an S256 code challenge and state
value locally, exchange the returned authorization code with the verifier, and
never contain a Spotify client secret. Access and refresh tokens remain on the
client that authorized Spotify. Expo stores them in SecureStore; the web client
stores them in per-tab `sessionStorage`. BeatFit's Supabase session is
independent of the Spotify authorization.

Each client implements the small provider-neutral music service contract and a
Spotify-specific adapter. The adapter normalizes Spotify records into BeatFit's
existing `Song` shape (`title`, `artist`, `duration_ms`, optional artwork, and a
Spotify catalog identifier). Workout generation continues through the existing
BeatFit API. FastAPI never receives a Spotify refresh token and does not need a
Spotify client secret for this metadata-first flow.

Stored Spotify tokens and pending web PKCE state are bound to the authenticated
BeatFit user ID. A different BeatFit user cannot restore the previous user's
Spotify authorization, explicit BeatFit sign-out clears Spotify authorization,
and the web OAuth callback requires a valid BeatFit session before client code
runs.

The integration deliberately does not use playback, Audio Features, Audio
Analysis, Recommendations, BPM, beat detection, or Spotify editorial content.

Implementation lives under `apps/mobile/src/services/spotify/` and
`apps/web/src/lib/spotify/`, with provider UI in each application. Repository
setup and verification commands are in the [main README](../README.md); the
provider-independent scope overview is in the [documentation index](README.md).

## Spotify Developer Dashboard setup

1. Create an application in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Copy its client ID into the public client environment variables below.
   Do not add the client secret to Expo, Next.js, source control, or a
   `NEXT_PUBLIC_`/`EXPO_PUBLIC_` variable.
3. Register every redirect URI exactly, including scheme, host, port, path,
   capitalization, and trailing slash. Spotify rejects `localhost`; for local
   web development use the literal loopback address.
4. Add the app owner and each tester under **Users Management**. Supply the
   account name and email exactly as Spotify expects.
5. The app requests only `playlist-read-private` and
   `playlist-read-collaborative`. A user can decline; reconnecting is required
   if the required scopes are absent.

Suggested redirect URIs:

```text
mobile://spotify-callback
http://127.0.0.1:3000/auth/spotify/callback
https://your-production-domain.example/auth/spotify/callback
```

For a production mobile application, prefer a claimed HTTPS universal/app link
and register that same URI in Spotify. The custom `mobile` scheme is appropriate
for local development, but it is less resistant to another installed app
claiming the callback.

## Environment variables

Mobile (`apps/mobile/.env`, based on `.env.example`):

```dotenv
EXPO_PUBLIC_SPOTIFY_ENABLED=true
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id
EXPO_PUBLIC_SPOTIFY_REDIRECT_URI=mobile://spotify-callback
```

Web (`apps/web/.env.local`, based on `.env.example`):

```dotenv
NEXT_PUBLIC_SPOTIFY_ENABLED=true
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id
NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/auth/spotify/callback
```

These values are public application configuration. No Spotify client secret is
required or permitted in either client. Restart Metro/Next.js after changing
them.

The `mobile://` callback must be handled by an installed BeatFit binary, so use
an Expo development build or a standalone build for end-to-end mobile OAuth.
Expo Go cannot claim BeatFit's custom scheme reliably. The mobile adapter uses
`expo-crypto` for PKCE and `expo-secure-store` for local token protection.

## API usage

The implementation uses only currently documented endpoints:

- `GET /v1/me/playlists`, followed via its `next` pagination URL.
- `GET /v1/playlists/{playlist_id}/items`, followed via its `next` URL.

The playlist-items response is read from each wrapper's `item` field. Older
playlist `/tracks` assumptions are intentionally absent. Local tracks, removed
items, non-track items, restricted/unplayable items, missing IDs, and records
without a positive duration stay visible where practical but cannot be
selected. A `429` error exposes Spotify's `Retry-After` delay rather than
silently retrying a user action.

Every displayed playlist or track includes its Spotify link when Spotify
supplies one. Both clients use Spotify's unmodified official full-logo asset for
attribution, and artwork is displayed without cropping or overlays in line with
Spotify's [design and branding guidelines](https://developer.spotify.com/documentation/design).

Access tokens are refreshed before expiry and once after an unexpected `401`.
The adapter accepts a rotated refresh token and retains the previous one when
Spotify omits a replacement. If refresh fails, local Spotify authorization is
cleared and the user must connect again.

Web tokens are intentionally stored in `sessionStorage`, limiting them to the
current browser tab; closing that tab requires reconnecting. Mobile tokens are
stored with SecureStore and are also cleared when the user disconnects Spotify
or signs out of BeatFit. Neither client logs token values.

## Current Development Mode and release limitations

Spotify's February 2026 Development Mode changes materially limit this MVP:

- The application owner must have Spotify Premium.
- A developer may own only one Development Mode client ID.
- At most five allowlisted users can use the app.
- Playlist listing can include followed playlists, but playlist items are
  available only when the user owns or collaborates on the playlist. Opening a
  followed playlist can therefore return `403`.
- New Development Mode apps receive a reduced endpoint and field set. BeatFit
  must not treat deprecated or unavailable endpoints as fallbacks.
- Refresh tokens have a fixed six-month lifetime; refresh calls do not extend
  it, so periodic reconnection is expected.

A broad public release is not possible in Development Mode. Spotify's current
[Extended Quota criteria](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
are discretionary and target established organizations with a launched service
and at least 250,000 monthly active users. BeatFit should treat Extended Quota
approval as an external product risk, not an assumed launch dependency.

## Manual verification

1. Configure the exact dashboard redirects and allowlist a Premium test user.
2. Enable the provider in the relevant local environment file and restart the
   app.
3. Connect Spotify, approve both playlist scopes, and confirm the playlist list
   loads across pagination.
4. Open a playlist owned by the test user, select several normal catalog
   tracks, and generate a workout. Confirm title, artist, duration, artwork,
   order, and Spotify identifier are retained.
5. Confirm local, unavailable, removed, and incomplete tracks are disabled.
6. Try an empty playlist, cancel authorization, disconnect/reconnect, and open a
   followed non-collaborative playlist to verify the empty/error states.
7. Test a second allowlisted user and confirm Spotify and BeatFit sessions do
   not leak across accounts or browser/device profiles.

## Official references

- [Authorization Code with PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
- [Redirect URI requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
- [February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Get current user's playlists](https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists)
- [Get playlist items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-tracks)
- [Design and branding guidelines](https://developer.spotify.com/documentation/design)
- [Scopes](https://developer.spotify.com/documentation/web-api/concepts/scopes)
- [Rate limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)

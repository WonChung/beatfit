# Security Policy

## Supported code

BeatFit does not publish versioned production releases from this repository.
Security fixes target the current `main` branch. Historical commits, forks,
locally modified builds, and third-party deployments are not maintained by this
project.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or include credentials,
access tokens, private keys, personal data, or exploit details in an issue.
Report vulnerabilities privately through the repository's **Security** tab using
a private vulnerability report or a draft security advisory. A maintainer will
acknowledge the report, assess impact, and coordinate remediation before public
disclosure.

Include the affected component and commit, reproduction steps, expected impact,
and any safe proof-of-concept details. Do not access another person's account,
music library, tokens, or data while researching a report. This repository does
not advertise a bug bounty or guaranteed response/remediation timeline.

If a credential may have been exposed, revoke or rotate it immediately. Removing
it from a later commit does not remove it from Git history.

## Current security boundaries

- FastAPI derives resource ownership from a verified Supabase JWT subject and
  does not accept client-supplied ownership IDs.
- Backend request logs omit headers, bodies, query strings, credentials, and raw
  exception messages. Error responses carry a request ID but no stack trace.
- Apple private keys remain backend-only. Spotify refresh tokens and Apple Music
  User Tokens are not sent to FastAPI.
- Web Spotify tokens use per-tab `sessionStorage`; mobile Spotify tokens use
  SecureStore and are bound to the BeatFit user.
- Web and mobile Apple Music adapters maintain a logical BeatFit owner binding
  and invalidate inherited provider authorization on account changes.
- Native Supabase sessions and music-provider credentials use SecureStore.
  Locally persisted workout data remains unencrypted, but each store is keyed by
  the verified Supabase user ID; unowned data from the former global key is
  quarantined rather than exposed to a signed-in account.
- Production database, TLS, secret-manager, backup, monitoring, and incident
  response controls belong to the deployment; this repository does not provide
  deployment automation. A public deployment must also enforce rate and abuse
  controls at its ingress or API gateway.

## Repository security settings

Repository administrators should enable and monitor:

- The dependency graph, Dependabot alerts, and Dependabot security updates.
- Secret scanning and push protection for contributors.
- Private vulnerability reporting.
- Branch protection for `main`, with the CI and dependency-review checks required.

Secret scanning and push protection are repository settings, not substitutes
for a CI workflow; they must be enabled explicitly in GitHub. The checked-in
[dependency review workflow](workflows/dependency-review.yml) evaluates pull
request dependency changes when the repository is public. Its API is not
available to an ordinary private personal repository, so that job skips until
the repository is public. An eligible private repository can opt in after its
administrator enables the required GitHub security product and deliberately
updates the workflow guard.
[Dependabot configuration](dependabot.yml) checks backend, mobile, web, and
GitHub Actions dependencies.

CI intentionally receives no application secrets. Tests and builds must use
documented placeholders, mocks, or isolated test credentials. Supabase
service-role keys, Apple private signing keys, database credentials, and music
provider tokens must never be committed or added to client-visible environment
variables.

See the [repository setup and CI guide](../README.md#continuous-integration) for
the local commands and checks expected before merging.

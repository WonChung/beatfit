# Security Policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or include credentials,
access tokens, private keys, personal data, or exploit details in an issue.
Report vulnerabilities privately through the repository's **Security** tab using
a private vulnerability report or a draft security advisory. A maintainer will
acknowledge the report, assess impact, and coordinate remediation before public
disclosure.

If a credential may have been exposed, revoke or rotate it immediately. Removing
it from a later commit does not remove it from Git history.

## Repository security settings

Repository administrators should enable and monitor:

- The dependency graph, Dependabot alerts, and Dependabot security updates.
- Secret scanning and push protection for contributors.
- Private vulnerability reporting.
- Branch protection for `main`, with the CI and dependency-review checks required.

Secret scanning and push protection are repository settings, not substitutes
for a CI workflow; they must be enabled explicitly in GitHub. The checked-in
[dependency review workflow](workflows/dependency-review.yml) evaluates pull
request dependency changes, and [Dependabot configuration](dependabot.yml)
checks backend, mobile, web, and GitHub Actions dependencies.

CI intentionally receives no application secrets. Tests and builds must use
documented placeholders, mocks, or isolated test credentials. Supabase
service-role keys, Apple private signing keys, database credentials, and music
provider tokens must never be committed or added to client-visible environment
variables.

See the [repository setup and CI guide](../README.md#continuous-integration) for
the local commands and checks expected before merging.

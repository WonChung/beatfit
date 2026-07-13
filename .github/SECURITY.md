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

CI intentionally receives no application secrets. Tests and builds must use
documented placeholders, mocks, or isolated test credentials. Supabase
service-role keys, Apple private signing keys, database credentials, and music
provider tokens must never be committed or added to client-visible environment
variables.

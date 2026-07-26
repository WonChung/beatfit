# brace-expansion compatibility adapter

This private package is a temporary compatibility boundary for
[`GHSA-mh99-v99m-4gvg`](https://github.com/advisories/GHSA-mh99-v99m-4gvg).
The currently resolved ESLint and Jest dependency trees still include
`minimatch@3`, which imports `brace-expansion` as a callable CommonJS export.
The only patched upstream release, `brace-expansion@5.0.8`, instead exposes a
named `expand` function.

The adapter does not implement brace expansion. It delegates every call to the
exact patched upstream release, installed under the
`brace-expansion-patched` alias by each host application, and exposes both
module shapes required by the legacy and current `minimatch` versions. The
mobile and web lockfiles force all transitive `brace-expansion` requests through
this package and CI exercises both interfaces after every clean install.

Remove this package once every direct dependency has moved away from the legacy
callable API or an official patched legacy release is available. At that point,
remove the file dependencies and overrides from both application manifests,
regenerate both npm lockfiles, and remove the CI compatibility checks.

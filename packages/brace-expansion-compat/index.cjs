"use strict";

const path = require("node:path");

const resolutionRoots = [
  process.cwd(),
  module.parent && path.dirname(module.parent.filename),
  require.main && path.dirname(require.main.filename),
].filter(Boolean);
const patchedModulePath = require.resolve("brace-expansion-patched", {
  paths: resolutionRoots,
});
const patchedBraceExpansion = require(patchedModulePath);
const expand = patchedBraceExpansion.expand;

// minimatch 3 expects require("brace-expansion") to be callable, while
// minimatch 10 expects the package to expose a named `expand` function.
module.exports = expand;
module.exports.expand = expand;
module.exports.EXPANSION_MAX = patchedBraceExpansion.EXPANSION_MAX;
module.exports.EXPANSION_MAX_LENGTH =
  patchedBraceExpansion.EXPANSION_MAX_LENGTH;

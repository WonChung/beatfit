"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const installedPackage = path.join(
  process.cwd(),
  "node_modules",
  "brace-expansion",
);
const installedEntryPoint = require.resolve(installedPackage);
const legacyExpand = require(installedEntryPoint);

assert.equal(typeof legacyExpand, "function");
assert.equal(typeof legacyExpand.expand, "function");
assert.equal(typeof legacyExpand.EXPANSION_MAX_LENGTH, "number");

const cases = [
  [
    "workout-{warmup,interval,cooldown}",
    ["workout-warmup", "workout-interval", "workout-cooldown"],
  ],
  ["set-{1..3}", ["set-1", "set-2", "set-3"]],
];

async function verify() {
  const modernModule = await import(pathToFileURL(installedEntryPoint).href);

  assert.equal(typeof modernModule.expand, "function");
  assert.equal(typeof modernModule.EXPANSION_MAX_LENGTH, "number");

  for (const [pattern, expected] of cases) {
    assert.deepEqual(legacyExpand(pattern), expected);
    assert.deepEqual(legacyExpand.expand(pattern), expected);
    assert.deepEqual(modernModule.expand(pattern), expected);
  }

  assert.deepEqual(legacyExpand("{a,b}{c,d}", { maxLength: 1 }), []);
  assert.deepEqual(modernModule.expand("{a,b}{c,d}", { maxLength: 1 }), []);

  console.log("brace-expansion compatibility adapter verified");
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

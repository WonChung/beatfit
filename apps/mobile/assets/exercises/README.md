# Exercise visual assets

BeatFit bundles exercise visuals locally so preview rows and workout-player
next-exercise thumbnails do not depend on a network request. The player's large
current-exercise view uses the separate
[animation registry](../exercise-animations/README.md), which falls back to
these static visuals for registered entries without pose assets. The current
SVGs are generic posture silhouettes shared by related exercises. They are
placeholders for reviewed, exercise-specific artwork, not complete form
instruction.

## Resolution pipeline

```text
backend exercise display name
  -> normalizeExerciseName()
  -> explicit alias lookup
  -> typed asset key or `fallback`
  -> static Metro require()
  -> ExerciseVisual
```

The pipeline is split deliberately:

- `src/utils/exercise-visual.ts` defines asset keys, name normalization, explicit
  aliases, and fallback resolution. It contains no React Native asset imports and
  can be tested as a pure utility.
- `src/components/exercise-visual.tsx` owns the static source table and rendering.
  Metro must be able to discover every `require()` at bundle time, so dynamic
  paths such as `require('./' + assetKey + '.svg')` must not be used.
- `src/utils/exercise-visual.test.ts` verifies requested names, common naming
  variations, normalization, and unknown-name fallback behavior.

## Current source table

All SVGs use a square `0 0 256 256` view box and render through `expo-image` with
`contentFit="contain"` and centered positioning.

| Asset key | File | Current exercise coverage |
| --- | --- | --- |
| `push-up` | `push-up.svg` | Scapular, standard, diamond, close-grip, incline, tempo wide, and plyometric push-ups; push-up hold |
| `prone` | `prone.svg` | Superman hold; reverse snow angels |
| `row` | `row.svg` | Dumbbell rows; bent-over rows |
| `squat` | `squat.svg` | Bodyweight and standard squats; reverse lunges; jump, goblet, hack, and dumbbell split squats |
| `wall-sit` | `wall-sit.svg` | Wall sit |
| `standing` | `standing.svg` | Arm circles; lateral raises; bicep curls and their catalog variants |
| `dip` | `dip.svg` | Triceps dips; bench triceps dip |
| `core-floor` | `core-floor.svg` | Dead bug; bicycle crunch; hollow hold |
| `plank` | `plank.svg` | Pike push-ups; shoulder taps; plank/forearm plank; mountain climbers |
| `fallback` | `fallback.svg` | Unknown, blank, or intentionally unmapped names |

Aliases include explicit singular/plural and current backend catalog variants.
Normalization handles case, surrounding/repeated whitespace, underscores,
hyphens and Unicode dashes, punctuation, and diacritics. It intentionally does
not guess exercise semantics or remove a generic trailing `s`, which could
damage words such as `triceps`.

## Fallback behavior

`resolveExerciseVisual()` returns both `assetKey` and `isFallback`. An unknown
exercise resolves to `fallback.svg`; `ExerciseVisual` announces it as a
placeholder and shows the exercise name by default. A caller may pass
`fallbackBehavior="hide"` when an unknown image would add clutter, or explicitly
control the label with `showLabel`.

Preview rows and the next-exercise thumbnail omit rest intervals. The player's
current interval renders through `ExerciseAnimation`, where every rest interval
uses the dedicated breathing pose pair instead of this registry's fallback.

## Replacing or adding artwork

For a replacement that keeps an existing asset key:

1. Replace the corresponding SVG while keeping its filename.
2. Preserve a square transparent view box and leave safe space around the body
   so the figure is not clipped at 52px thumbnails.
3. Verify contrast in BeatFit light and dark themes.
4. Review the depicted starting position and exercise form with a qualified
   fitness professional.
5. Run the mapping tests and an Expo export, then inspect preview/current/next
   sizes on physical small-screen devices.

For a new posture or an exercise-specific visual:

1. Add the SVG to this directory using a stable lowercase kebab-case filename.
2. Add its key to `EXERCISE_VISUAL_ASSET_KEYS`.
3. Add an alias group in `aliasEntries`. Keep every supported spelling explicit
   when singularization could be ambiguous.
4. Add a static `require()` entry to `EXERCISE_VISUAL_SOURCES`.
5. Add the canonical exercise and useful naming variations to
   `exercise-visual.test.ts`.
6. Update the source table in this README.

Do not add remote URLs or runtime-downloaded exercise art. Confirm ownership and
distribution rights for every production asset before release, and keep source
or license records outside the runtime asset directory where the project can
audit them.

## Artwork and accessibility requirements

- SVGs should have a transparent square view box, centered figure, consistent
  scale, and enough padding for rounded containers.
- Preserve aspect ratio; do not pre-stretch figures to a particular screen size.
- Prefer simple high-contrast shapes that remain understandable at 52px.
- Do not encode essential instructions only in the image. The exercise name and
  interval type remain visible text in the UI.
- `ExerciseVisual` supplies an image role and an accessibility label of either
  `Exercise visual for <name>` or `Placeholder exercise visual for <name>`.
- If an illustration needs a more detailed form description, extend the typed
  metadata/component instead of embedding inaccessible text in the SVG.
- Keep motion out of `ExerciseVisual`; add it through the documented animation
  registry, which already defines pause and reduced-motion behavior.

## Testing checklist

Automated checks from `apps/mobile`:

```bash
npm test -- --runTestsByPath src/utils/exercise-visual.test.ts
npm run lint
npm run typecheck
npx expo export --platform ios --output-dir dist
```

Manual checks:

1. Generate workouts for every muscle group and inspect non-rest preview rows.
2. Start a workout and verify the large current visual updates on automatic,
   skipped, and previous interval transitions.
3. Verify the optional next-exercise thumbnail and its spacing.
4. Exercise an unmapped name and confirm the fallback and visible label.
5. Check VoiceOver/TalkBack announcements and dynamic text alongside the visual.
6. Check 52px, 56px, and 180px render sizes in light/dark themes and on a small
   physical device.
7. Disable networking to confirm every silhouette remains available offline.

An Expo export validates that Metro found and bundled the SVG source table. It
does not replace visual review, native device testing, licensing review, or
fitness-form review.

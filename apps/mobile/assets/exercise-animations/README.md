# Mobile exercise animation assets

The workout player's current interval uses these bundled SVG pose pairs. The
component cross-fades poses with React Native `Animated`; it does not download
artwork or execute SVG animation code. Preview rows and the player's next item
use the separate static assets in [`../exercises`](../exercises/README.md).

## Resolution pipeline

```text
exercise_id + display name + interval type
  -> stable ID registry lookup
  -> normalized legacy-name lookup
  -> rest / known animation / static posture / generic fallback
  -> static Metro require() source map
  -> ExerciseAnimation
```

`src/utils/exercise-animation.ts` owns the registry and playback policy.
`src/components/exercise-animation.tsx` owns static asset imports and rendering.
Stable backend IDs take priority because display names may change. Name aliases
keep older snapshots without `exercise_id` usable.

## Current assets

| Files | Use |
| --- | --- |
| `push-up-start.svg`, `push-up-end.svg` | Looping standard push-up cycle and static poses for selected push-up variants. |
| `squat-start.svg`, `squat-end.svg` | Looping bodyweight-squat cycle. |
| `mountain-climber-start.svg`, `mountain-climber-end.svg` | Looping mountain-climber cycle. |
| `rest-start.svg`, `rest-end.svg` | Slow breathing cycle for every `rest` interval. |
| `generic-start.svg`, `generic-end.svg` | Offline motion fallback for an unknown exercise. |

The registry also recognizes Diamond Push-Ups, Scapular Push-Ups, Push-Up Hold,
Reverse Lunges, Wall Sit, Jump Squats, Plank, Bicycle Crunch, Dead Bug, Hollow
Hold, Superman Hold, Reverse Snow Angels, Dumbbell Rows, Bent-Over Rows, Bicep
Curls, Lateral Raises, Pike Push-Ups, Shoulder Taps, Triceps Dips, and
Close-Grip Push-Ups. Entries without a pose in this directory render through
the static `ExerciseVisual` asset registry.

All pose SVGs use a `0 0 256 256` view box and the same silhouette palette and
scale. Keep transparent padding consistent so cross-fades do not jump.

## Playback and accessibility

- Warm-up uses a slower multiplier, work uses the base speed, and burnout uses
  a faster multiplier.
- Pausing the workout stops the active animation at its current pose.
- Reduced-motion defaults to a static pose until the platform preference is
  known and stays static when reduced motion is enabled.
- The active view has one image role and announces either the exercise
  demonstration or the rest breathing demonstration; individual pose layers
  are hidden from accessibility services.
- Animation is illustrative, not form instruction. The exercise name and
  interval type remain visible text.

## Adding or replacing an animation

1. Add a start/end pair with lowercase kebab-case names and matching square
   view boxes, scale, padding, and visual style.
2. Add both keys to `EXERCISE_ANIMATION_POSE_KEYS` in
   `src/utils/exercise-animation.ts`.
3. Add static `require()` entries to `EXERCISE_ANIMATION_POSES` in
   `src/components/exercise-animation.tsx`; Metro cannot bundle a dynamic path.
4. Add or update the stable exercise-ID registry entry and explicit legacy-name
   aliases.
5. Test paused, running, reduced-motion, warm-up, work, burnout, and rest
   behavior. Inspect the transition on a physical small-screen device.
6. Update the table above and retain source/license records for production art.

Do not imply that a two-pose cross-fade demonstrates safe technique. Production
exercise-specific art should be reviewed by a qualified fitness professional.

## Verification

From `apps/mobile`:

```bash
npm test -- --runTestsByPath src/utils/exercise-animation.test.ts
npm run lint
npm run typecheck
npx expo export --platform ios --output-dir dist
```

An Expo export confirms Metro can discover the static assets. It does not
replace device accessibility, reduced-motion, visual, licensing, or fitness-form
review.

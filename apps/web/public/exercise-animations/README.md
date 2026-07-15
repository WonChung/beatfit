# Web exercise animation assets

The active web workout interval renders these local SVG poses as layered CSS
backgrounds. No exercise artwork is fetched from a third-party service.

## Resolution pipeline

```text
exercise_id + display name + interval type
  -> stable ID registry lookup
  -> normalized legacy-name lookup
  -> rest / known pose set / generic fallback
  -> public asset URL map
  -> ExerciseAnimation
```

`src/lib/exercise-animation.ts` owns stable IDs, aliases, asset URLs, and
playback policy. `src/components/exercise-animation.tsx` owns viewport/page
visibility, reduced-motion detection, and rendering. Stable backend IDs take
priority; normalized display-name aliases preserve older snapshots.

## Current assets

| Files | Use |
| --- | --- |
| `push-up-start.svg`, `push-up-end.svg` | Looping standard push-up cycle; static Diamond Push-Up pose. |
| `squat-start.svg`, `squat-end.svg` | Looping bodyweight-squat cycle; static Reverse Lunge pose. |
| `mountain-climber-start.svg`, `mountain-climber-end.svg` | Looping mountain-climber cycle. |
| `rest-start.svg`, `rest-end.svg` | Slow breathing cycle for all rest intervals. |
| `generic-start.svg`, `generic-end.svg` | Offline fallback for unknown exercises. |
| `plank-static.svg` | Static Plank pose. |
| `row-static.svg` | Static Dumbbell Row pose. |
| `core-floor-static.svg` | Static Bicycle Crunch pose. |
| `standing-static.svg` | Static Bicep Curl and Lateral Raise posture. |

All assets use a `0 0 256 256` view box. Pose pairs must retain consistent
scale, padding, palette, and alignment so their opacity cross-fade does not
jump.

## Playback and accessibility

- Warm-up, work, and burnout intervals apply different speed multipliers.
- Timer pause stops motion.
- `prefers-reduced-motion: reduce` selects a static start pose.
- Motion pauses while the component is outside the viewport or the page is
  hidden; `IntersectionObserver` falls back to visible when unavailable.
- Rest always resolves to the breathing cycle, regardless of the previous
  exercise ID or name.
- The wrapper exposes one image role and descriptive label. Pose layers are
  decorative and hidden from assistive technology.

These are demonstrations, not complete form instruction. Keep the exercise
name and interval type visible and do not encode essential safety guidance only
in artwork.

## Adding or replacing an asset

1. Add the SVG under this directory with a lowercase kebab-case filename and a
   square transparent view box.
2. Add the key and public path to `EXERCISE_ANIMATION_POSE_KEYS` and
   `EXERCISE_ANIMATION_POSE_ASSETS` in `src/lib/exercise-animation.ts`.
3. Add or update the stable exercise-ID registry entry and explicit legacy-name
   aliases.
4. Verify running, paused, off-screen, hidden-page, and reduced-motion states.
5. Test at the player size and at narrow browser widths, then update this table.
6. Retain source and distribution-rights records for production artwork.

## Verification

From `apps/web`:

```bash
npm test -- src/lib/exercise-animation.test.ts
npm run lint
npm run typecheck
npm run build
```

Automated checks verify registry and playback-state behavior. They do not
replace accessibility, visual, licensing, or fitness-form review.

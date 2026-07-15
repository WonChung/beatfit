# Web exercise animation assets

`ExerciseAnimation` displays these local SVG pose assets as layered CSS backgrounds. No exercise artwork is fetched at runtime.

Working exercise-specific animation cycles:

- Push-Ups (`chest-bodyweight-push-up`)
- Bodyweight Squats (`legs-bodyweight-bodyweight-squat`)
- Mountain Climbers (`full_body-bodyweight-mountain-climbers`)

The folder also includes a slow breathing cycle for rest intervals and a generic movement cycle for unknown exercises.

These initially supported exercises currently use static local fallback poses until dedicated pose pairs are available:

- Diamond Push-Ups
- Reverse Lunges
- Plank
- Bicycle Crunch
- Dumbbell Rows
- Bicep Curls
- Lateral Raises

All assets use a `0 0 256 256` view box to avoid layout changes. Add new pose keys to `src/lib/exercise-animation.ts` before using new files.

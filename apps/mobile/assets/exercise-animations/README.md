# Exercise animation assets

These local SVG pose pairs are cross-faded by `ExerciseAnimation`. No asset is fetched at runtime.

Working exercise-specific cycles:

- Push-Ups (`chest-bodyweight-push-up`)
- Bodyweight Squats (`legs-bodyweight-bodyweight-squat`)
- Mountain Climbers (`full_body-bodyweight-mountain-climbers`)

The folder also contains a slow breathing cycle for rest intervals and a generic movement cycle for unknown exercises.

The following initial exercises currently resolve through the registry but use a static local pose or the existing static exercise visual until dedicated pose pairs are added:

- Diamond Push-Ups
- Scapular Push-Ups
- Push-Up Hold
- Reverse Lunges
- Wall Sit
- Jump Squats
- Plank
- Bicycle Crunch
- Dead Bug
- Hollow Hold
- Superman Hold
- Reverse Snow Angels
- Dumbbell Rows
- Bent-Over Rows
- Bicep Curls
- Lateral Raises
- Pike Push-Ups
- Shoulder Taps
- Triceps Dips
- Close-Grip Push-Ups

New animations should use the shared `0 0 256 256` view box, retain the blue silhouette palette, and be registered in `src/utils/exercise-animation.ts` before being added to the component's local pose source map.

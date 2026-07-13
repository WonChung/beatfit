export const EXERCISE_VISUAL_ASSET_KEYS = [
  'push-up',
  'prone',
  'row',
  'squat',
  'wall-sit',
  'standing',
  'dip',
  'core-floor',
  'plank',
  'fallback',
] as const;

export type ExerciseVisualAssetKey = (typeof EXERCISE_VISUAL_ASSET_KEYS)[number];

export interface ExerciseVisualResolution {
  assetKey: ExerciseVisualAssetKey;
  isFallback: boolean;
}

const aliasEntries: readonly (readonly [ExerciseVisualAssetKey, readonly string[]])[] = [
  [
    'push-up',
    [
      'Scapular Push-Ups',
      'Scapular Push-Up',
      'Scapular Pushups',
      'Push-Ups',
      'Push-Up',
      'Pushups',
      'Pushup',
      'Diamond Push-Ups',
      'Diamond Push-Up',
      'Push-Up Hold',
      'Close-Grip Push-Ups',
      'Close-Grip Push-Up',
      'Incline Push-Up',
      'Tempo Wide Push-Up',
      'Plyometric Push-Up',
    ],
  ],
  [
    'prone',
    [
      'Superman Hold',
      'Superman Holds',
      'Reverse Snow Angels',
      'Reverse Snow Angel',
    ],
  ],
  ['row', ['Dumbbell Rows', 'Dumbbell Row', 'Bent-Over Rows', 'Bent-Over Row']],
  [
    'squat',
    [
      'Bodyweight Squats',
      'Bodyweight Squat',
      'Body Weight Squats',
      'Body Weight Squat',
      'Reverse Lunges',
      'Reverse Lunge',
      'Jump Squats',
      'Jump Squat',
      'Squats',
      'Squat',
      'Goblet Squat',
      'Hack Squat',
      'Dumbbell Split Squat',
    ],
  ],
  ['wall-sit', ['Wall Sit', 'Wall Sits']],
  [
    'standing',
    [
      'Arm Circles',
      'Arm Circle',
      'Lateral Raises',
      'Lateral Raise',
      'Dumbbell Lateral Raises',
      'Dumbbell Lateral Raise',
      'Cable Lateral Raise',
      'Bicep Curls',
      'Bicep Curl',
      'Biceps Curls',
      'Biceps Curl',
      'Dumbbell Curl',
    ],
  ],
  ['dip', ['Triceps Dips', 'Triceps Dip', 'Tricep Dips', 'Tricep Dip', 'Bench Triceps Dip']],
  [
    'core-floor',
    [
      'Dead Bug',
      'Dead Bugs',
      'Bicycle Crunch',
      'Bicycle Crunches',
      'Hollow Hold',
      'Hollow Holds',
    ],
  ],
  [
    'plank',
    [
      'Pike Push-Ups',
      'Pike Push-Up',
      'Shoulder Taps',
      'Shoulder Tap',
      'Plank',
      'Planks',
      'Forearm Plank',
      'Mountain Climbers',
      'Mountain Climber',
    ],
  ],
] as const;

const EXERCISE_VISUAL_ALIASES: ReadonlyMap<string, ExerciseVisualAssetKey> = new Map(
  aliasEntries.flatMap(([assetKey, aliases]) =>
    aliases.map((alias) => [normalizeExerciseName(alias), assetKey] as const)
  )
);

/**
 * Normalizes display-name differences without guessing at exercise semantics.
 * Singular/plural variants stay explicit in the alias table so words such as
 * "triceps" are never damaged by a generic trailing-s rule.
 */
export function normalizeExerciseName(exerciseName: string): string {
  return exerciseName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function resolveExerciseVisual(exerciseName: string): ExerciseVisualResolution {
  const assetKey = EXERCISE_VISUAL_ALIASES.get(normalizeExerciseName(exerciseName));
  return assetKey
    ? { assetKey, isFallback: false }
    : { assetKey: 'fallback', isFallback: true };
}

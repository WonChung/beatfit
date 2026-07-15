import { normalizeExerciseName } from './exercise-visual';

export const EXERCISE_ANIMATION_KEYS = [
  'push-up-cycle',
  'squat-cycle',
  'mountain-climber-cycle',
  'breathing-cycle',
  'generic-cycle',
  'static',
] as const;

export type ExerciseAnimationKey = (typeof EXERCISE_ANIMATION_KEYS)[number];

export const EXERCISE_ANIMATION_POSE_KEYS = [
  'push-up-start',
  'push-up-end',
  'squat-start',
  'squat-end',
  'mountain-climber-start',
  'mountain-climber-end',
  'rest-start',
  'rest-end',
  'generic-start',
  'generic-end',
] as const;

export type ExerciseAnimationPoseKey = (typeof EXERCISE_ANIMATION_POSE_KEYS)[number];

export interface ExerciseAnimationDefinition {
  exerciseId: string;
  animationKey: ExerciseAnimationKey;
  startPoseKey?: ExerciseAnimationPoseKey;
  endPoseKey?: ExerciseAnimationPoseKey;
  loop: boolean;
  playbackSpeed?: number;
}

export type ExerciseAnimationResolutionSource =
  | 'exercise-id'
  | 'exercise-name'
  | 'fallback'
  | 'rest';

export interface ResolvedExerciseAnimation extends ExerciseAnimationDefinition {
  playbackSpeed: number;
  renderKey: string;
  source: ExerciseAnimationResolutionSource;
}

interface RegistryEntry extends ExerciseAnimationDefinition {
  names: readonly string[];
}

const registryEntries: readonly RegistryEntry[] = [
  {
    exerciseId: 'chest-bodyweight-push-up',
    names: ['Push-Ups', 'Push-Up', 'Pushups', 'Pushup'],
    animationKey: 'push-up-cycle',
    startPoseKey: 'push-up-start',
    endPoseKey: 'push-up-end',
    loop: true,
    playbackSpeed: 0.85,
  },
  {
    exerciseId: 'chest-bodyweight-diamond-push-up',
    names: ['Diamond Push-Ups', 'Diamond Push-Up'],
    animationKey: 'static',
    startPoseKey: 'push-up-start',
    loop: false,
  },
  {
    exerciseId: 'chest-bodyweight-scapular-push-up',
    names: ['Scapular Push-Ups', 'Scapular Push-Up', 'Scapular Pushups'],
    animationKey: 'static',
    startPoseKey: 'push-up-start',
    loop: false,
  },
  {
    exerciseId: 'chest-bodyweight-push-up-hold',
    names: ['Push-Up Hold'],
    animationKey: 'static',
    startPoseKey: 'push-up-end',
    loop: false,
  },
  {
    exerciseId: 'legs-bodyweight-bodyweight-squat',
    names: ['Bodyweight Squats', 'Bodyweight Squat', 'Body Weight Squats', 'Body Weight Squat'],
    animationKey: 'squat-cycle',
    startPoseKey: 'squat-start',
    endPoseKey: 'squat-end',
    loop: true,
    playbackSpeed: 0.9,
  },
  {
    exerciseId: 'legs-bodyweight-reverse-lunge',
    names: ['Reverse Lunges', 'Reverse Lunge'],
    animationKey: 'static',
    loop: false,
  },
  {
    exerciseId: 'legs-bodyweight-wall-sit',
    names: ['Wall Sit', 'Wall Sits'],
    animationKey: 'static',
    loop: false,
  },
  {
    exerciseId: 'legs-bodyweight-jump-squat',
    names: ['Jump Squats', 'Jump Squat'],
    animationKey: 'static',
    loop: false,
    playbackSpeed: 1.4,
  },
  {
    exerciseId: 'core-bodyweight-forearm-plank',
    names: ['Plank', 'Planks', 'Forearm Plank'],
    animationKey: 'static',
    loop: false,
  },
  {
    exerciseId: 'full_body-bodyweight-mountain-climbers',
    names: ['Mountain Climbers', 'Mountain Climber'],
    animationKey: 'mountain-climber-cycle',
    startPoseKey: 'mountain-climber-start',
    endPoseKey: 'mountain-climber-end',
    loop: true,
    playbackSpeed: 1.5,
  },
  {
    exerciseId: 'core-bodyweight-bicycle-crunch',
    names: ['Bicycle Crunch', 'Bicycle Crunches'],
    animationKey: 'static',
    loop: false,
  },
  {
    exerciseId: 'core-bodyweight-dead-bug',
    names: ['Dead Bug', 'Dead Bugs'],
    animationKey: 'static',
    loop: false,
  },
  {
    exerciseId: 'core-bodyweight-hollow-hold',
    names: ['Hollow Hold', 'Hollow Holds'],
    animationKey: 'static',
    loop: false,
  },
  {
    exerciseId: 'back-bodyweight-superman-hold',
    names: ['Superman Hold', 'Superman Holds'],
    animationKey: 'static',
    loop: false,
  },
  {
    exerciseId: 'back-bodyweight-reverse-snow-angel',
    names: ['Reverse Snow Angels', 'Reverse Snow Angel'],
    animationKey: 'static',
    loop: false,
  },
  {
    exerciseId: 'back-dumbbells-dumbbell-row',
    names: ['Dumbbell Rows', 'Dumbbell Row'],
    animationKey: 'static',
    loop: false,
  },
  {
    exerciseId: 'back-dumbbells-bent-over-row',
    names: ['Bent-Over Rows', 'Bent-Over Row'],
    animationKey: 'static',
    loop: false,
  },
  {
    exerciseId: 'arms-dumbbells-dumbbell-curl',
    names: ['Bicep Curls', 'Bicep Curl', 'Biceps Curls', 'Biceps Curl', 'Dumbbell Curl'],
    animationKey: 'static',
    loop: false,
  },
  {
    exerciseId: 'shoulders-dumbbells-dumbbell-lateral-raise',
    names: ['Lateral Raises', 'Lateral Raise', 'Dumbbell Lateral Raise'],
    animationKey: 'static',
    loop: false,
  },
  {
    exerciseId: 'shoulders-bodyweight-pike-push-up',
    names: ['Pike Push-Ups', 'Pike Push-Up'],
    animationKey: 'static',
    loop: false,
  },
  {
    exerciseId: 'shoulders-bodyweight-shoulder-tap',
    names: ['Shoulder Taps', 'Shoulder Tap'],
    animationKey: 'static',
    loop: false,
  },
  {
    exerciseId: 'arms-bodyweight-bench-triceps-dip',
    names: ['Triceps Dips', 'Triceps Dip', 'Tricep Dips', 'Tricep Dip', 'Bench Triceps Dip'],
    animationKey: 'static',
    loop: false,
  },
  {
    exerciseId: 'arms-bodyweight-close-grip-push-up',
    names: ['Close-Grip Push-Ups', 'Close-Grip Push-Up'],
    animationKey: 'static',
    startPoseKey: 'push-up-start',
    loop: false,
  },
] as const;

export const EXERCISE_ANIMATION_REGISTRY: Readonly<
  Record<string, ExerciseAnimationDefinition>
> = Object.freeze(
  Object.fromEntries(
    registryEntries.map(({ names: _names, ...definition }) => [definition.exerciseId, definition])
  )
);

const EXERCISE_NAME_TO_ID: ReadonlyMap<string, string> = new Map(
  registryEntries.flatMap((entry) =>
    entry.names.map((name) => [normalizeExerciseName(name), entry.exerciseId] as const)
  )
);

const REST_ANIMATION: ExerciseAnimationDefinition = {
  exerciseId: 'interval-rest',
  animationKey: 'breathing-cycle',
  startPoseKey: 'rest-start',
  endPoseKey: 'rest-end',
  loop: true,
  playbackSpeed: 0.45,
};

const GENERIC_ANIMATION: ExerciseAnimationDefinition = {
  exerciseId: 'unknown-exercise',
  animationKey: 'generic-cycle',
  startPoseKey: 'generic-start',
  endPoseKey: 'generic-end',
  loop: true,
  playbackSpeed: 0.75,
};

const INTERVAL_SPEED_MULTIPLIERS: Readonly<Record<string, number>> = {
  warmup: 0.8,
  work: 1,
  rest: 1,
  burnout: 1.2,
};

function normalizedIntervalType(intervalType: string | undefined): string {
  return intervalType?.trim().toLowerCase() || 'work';
}

function withResolution(
  definition: ExerciseAnimationDefinition,
  source: ExerciseAnimationResolutionSource,
  intervalType: string,
  identity: string
): ResolvedExerciseAnimation {
  const multiplier = INTERVAL_SPEED_MULTIPLIERS[intervalType] ?? 1;
  return {
    ...definition,
    playbackSpeed: (definition.playbackSpeed ?? 1) * multiplier,
    renderKey: `${intervalType}:${identity}:${definition.animationKey}`,
    source,
  };
}

export function resolveExerciseAnimation({
  exerciseId,
  exerciseName,
  intervalType,
}: {
  exerciseId?: string | null;
  exerciseName: string;
  intervalType?: string;
}): ResolvedExerciseAnimation {
  const normalizedType = normalizedIntervalType(intervalType);
  if (normalizedType === 'rest') {
    return withResolution(REST_ANIMATION, 'rest', normalizedType, REST_ANIMATION.exerciseId);
  }

  const trimmedId = exerciseId?.trim();
  if (trimmedId) {
    const idDefinition = EXERCISE_ANIMATION_REGISTRY[trimmedId];
    if (idDefinition) {
      return withResolution(idDefinition, 'exercise-id', normalizedType, trimmedId);
    }
  }

  const normalizedName = normalizeExerciseName(exerciseName);
  const nameExerciseId = EXERCISE_NAME_TO_ID.get(normalizedName);
  if (nameExerciseId) {
    return withResolution(
      EXERCISE_ANIMATION_REGISTRY[nameExerciseId],
      'exercise-name',
      normalizedType,
      nameExerciseId
    );
  }

  const fallbackIdentity = trimmedId || normalizedName || GENERIC_ANIMATION.exerciseId;
  return withResolution(GENERIC_ANIMATION, 'fallback', normalizedType, fallbackIdentity);
}

export type ExerciseAnimationPlaybackState =
  | 'animating'
  | 'paused'
  | 'reduced-motion'
  | 'static';

export function getExerciseAnimationPlaybackState({
  animation,
  isPaused,
  reduceMotionEnabled,
}: {
  animation: ResolvedExerciseAnimation;
  isPaused: boolean;
  reduceMotionEnabled: boolean;
}): ExerciseAnimationPlaybackState {
  const hasPosePair = Boolean(animation.startPoseKey && animation.endPoseKey);
  if (animation.animationKey === 'static' || !hasPosePair) return 'static';
  if (reduceMotionEnabled) return 'reduced-motion';
  return isPaused ? 'paused' : 'animating';
}

export const EXERCISE_ANIMATION_KEYS = [
  "push-up-cycle",
  "squat-cycle",
  "mountain-climber-cycle",
  "breathing-cycle",
  "generic-cycle",
  "static",
] as const;

export type ExerciseAnimationKey = (typeof EXERCISE_ANIMATION_KEYS)[number];

export const EXERCISE_ANIMATION_POSE_KEYS = [
  "push-up-start",
  "push-up-end",
  "squat-start",
  "squat-end",
  "mountain-climber-start",
  "mountain-climber-end",
  "rest-start",
  "rest-end",
  "generic-start",
  "generic-end",
  "plank-static",
  "row-static",
  "core-floor-static",
  "standing-static",
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

export const EXERCISE_ANIMATION_POSE_ASSETS: Readonly<
  Record<ExerciseAnimationPoseKey, string>
> = Object.freeze({
  "push-up-start": "/exercise-animations/push-up-start.svg",
  "push-up-end": "/exercise-animations/push-up-end.svg",
  "squat-start": "/exercise-animations/squat-start.svg",
  "squat-end": "/exercise-animations/squat-end.svg",
  "mountain-climber-start": "/exercise-animations/mountain-climber-start.svg",
  "mountain-climber-end": "/exercise-animations/mountain-climber-end.svg",
  "rest-start": "/exercise-animations/rest-start.svg",
  "rest-end": "/exercise-animations/rest-end.svg",
  "generic-start": "/exercise-animations/generic-start.svg",
  "generic-end": "/exercise-animations/generic-end.svg",
  "plank-static": "/exercise-animations/plank-static.svg",
  "row-static": "/exercise-animations/row-static.svg",
  "core-floor-static": "/exercise-animations/core-floor-static.svg",
  "standing-static": "/exercise-animations/standing-static.svg",
});

export type ExerciseAnimationResolutionSource =
  | "exercise-id"
  | "exercise-name"
  | "fallback"
  | "rest";

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
    exerciseId: "chest-bodyweight-push-up",
    names: ["Push-Ups", "Push-Up", "Pushups", "Pushup"],
    animationKey: "push-up-cycle",
    startPoseKey: "push-up-start",
    endPoseKey: "push-up-end",
    loop: true,
    playbackSpeed: 0.85,
  },
  {
    exerciseId: "chest-bodyweight-diamond-push-up",
    names: ["Diamond Push-Ups", "Diamond Push-Up"],
    animationKey: "static",
    startPoseKey: "push-up-start",
    loop: false,
  },
  {
    exerciseId: "legs-bodyweight-bodyweight-squat",
    names: ["Bodyweight Squats", "Bodyweight Squat", "Body Weight Squats", "Body Weight Squat"],
    animationKey: "squat-cycle",
    startPoseKey: "squat-start",
    endPoseKey: "squat-end",
    loop: true,
    playbackSpeed: 0.9,
  },
  {
    exerciseId: "legs-bodyweight-reverse-lunge",
    names: ["Reverse Lunges", "Reverse Lunge"],
    animationKey: "static",
    startPoseKey: "squat-end",
    loop: false,
  },
  {
    exerciseId: "core-bodyweight-forearm-plank",
    names: ["Plank", "Planks", "Forearm Plank"],
    animationKey: "static",
    startPoseKey: "plank-static",
    loop: false,
  },
  {
    exerciseId: "full_body-bodyweight-mountain-climbers",
    names: ["Mountain Climbers", "Mountain Climber"],
    animationKey: "mountain-climber-cycle",
    startPoseKey: "mountain-climber-start",
    endPoseKey: "mountain-climber-end",
    loop: true,
    playbackSpeed: 1.5,
  },
  {
    exerciseId: "core-bodyweight-bicycle-crunch",
    names: ["Bicycle Crunch", "Bicycle Crunches"],
    animationKey: "static",
    startPoseKey: "core-floor-static",
    loop: false,
  },
  {
    exerciseId: "back-dumbbells-dumbbell-row",
    names: ["Dumbbell Rows", "Dumbbell Row"],
    animationKey: "static",
    startPoseKey: "row-static",
    loop: false,
  },
  {
    exerciseId: "arms-dumbbells-dumbbell-curl",
    names: ["Bicep Curls", "Bicep Curl", "Biceps Curls", "Biceps Curl", "Dumbbell Curl"],
    animationKey: "static",
    startPoseKey: "standing-static",
    loop: false,
  },
  {
    exerciseId: "shoulders-dumbbells-dumbbell-lateral-raise",
    names: ["Lateral Raises", "Lateral Raise", "Dumbbell Lateral Raise"],
    animationKey: "static",
    startPoseKey: "standing-static",
    loop: false,
  },
] as const;

export const EXERCISE_ANIMATION_REGISTRY: Readonly<
  Record<string, ExerciseAnimationDefinition>
> = Object.freeze(
  Object.fromEntries(
    registryEntries.map((entry) => [entry.exerciseId, definitionFromEntry(entry)]),
  ),
);

function definitionFromEntry(entry: RegistryEntry): ExerciseAnimationDefinition {
  return {
    exerciseId: entry.exerciseId,
    animationKey: entry.animationKey,
    startPoseKey: entry.startPoseKey,
    endPoseKey: entry.endPoseKey,
    loop: entry.loop,
    playbackSpeed: entry.playbackSpeed,
  };
}

const EXERCISE_NAME_TO_ID: ReadonlyMap<string, string> = new Map(
  registryEntries.flatMap((entry) =>
    entry.names.map((name) => [normalizeExerciseName(name), entry.exerciseId] as const),
  ),
);

const REST_ANIMATION: ExerciseAnimationDefinition = {
  exerciseId: "interval-rest",
  animationKey: "breathing-cycle",
  startPoseKey: "rest-start",
  endPoseKey: "rest-end",
  loop: true,
  playbackSpeed: 0.45,
};

const GENERIC_ANIMATION: ExerciseAnimationDefinition = {
  exerciseId: "unknown-exercise",
  animationKey: "generic-cycle",
  startPoseKey: "generic-start",
  endPoseKey: "generic-end",
  loop: true,
  playbackSpeed: 0.75,
};

const INTERVAL_SPEED_MULTIPLIERS: Readonly<Record<string, number>> = {
  warmup: 0.8,
  work: 1,
  rest: 1,
  burnout: 1.2,
};

const LOOPING_INTERVAL_TYPES = new Set(["warmup", "work", "rest", "burnout"]);

export function normalizeExerciseName(exerciseName: string): string {
  return exerciseName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeIntervalType(intervalType: string): string {
  return intervalType.trim().toLowerCase() || "work";
}

function withResolution(
  definition: ExerciseAnimationDefinition,
  source: ExerciseAnimationResolutionSource,
  intervalType: string,
  identity: string,
): ResolvedExerciseAnimation {
  const multiplier = INTERVAL_SPEED_MULTIPLIERS[intervalType] ?? 1;
  return {
    ...definition,
    loop: definition.loop && LOOPING_INTERVAL_TYPES.has(intervalType),
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
  exerciseId: string | null | undefined;
  exerciseName: string;
  intervalType: string;
}): ResolvedExerciseAnimation {
  const normalizedType = normalizeIntervalType(intervalType);
  if (normalizedType === "rest") {
    return withResolution(REST_ANIMATION, "rest", normalizedType, REST_ANIMATION.exerciseId);
  }

  const trimmedId = exerciseId?.trim();
  if (trimmedId) {
    const idDefinition = EXERCISE_ANIMATION_REGISTRY[trimmedId];
    if (idDefinition) {
      return withResolution(idDefinition, "exercise-id", normalizedType, trimmedId);
    }
  }

  const normalizedName = normalizeExerciseName(exerciseName);
  const nameExerciseId = EXERCISE_NAME_TO_ID.get(normalizedName);
  if (nameExerciseId) {
    return withResolution(
      EXERCISE_ANIMATION_REGISTRY[nameExerciseId],
      "exercise-name",
      normalizedType,
      nameExerciseId,
    );
  }

  const fallbackIdentity = trimmedId || normalizedName || GENERIC_ANIMATION.exerciseId;
  return withResolution(GENERIC_ANIMATION, "fallback", normalizedType, fallbackIdentity);
}

export type ExerciseAnimationPlaybackState =
  | "animating"
  | "paused"
  | "reduced-motion"
  | "static";

export function getExerciseAnimationPlaybackState({
  animation,
  isPaused,
  isVisible,
  reduceMotionEnabled,
}: {
  animation: ResolvedExerciseAnimation;
  isPaused: boolean;
  isVisible: boolean;
  reduceMotionEnabled: boolean;
}): ExerciseAnimationPlaybackState {
  const hasPosePair = Boolean(animation.startPoseKey && animation.endPoseKey);
  if (animation.animationKey === "static" || !animation.loop || !hasPosePair) return "static";
  if (reduceMotionEnabled) return "reduced-motion";
  return isPaused || !isVisible ? "paused" : "animating";
}

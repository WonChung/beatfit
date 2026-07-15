import { describe, expect, it } from "vitest";
import {
  EXERCISE_ANIMATION_REGISTRY,
  getExerciseAnimationPlaybackState,
  normalizeExerciseName,
  resolveExerciseAnimation,
} from "./exercise-animation";

const supportedExerciseNames = [
  "Push-Ups",
  "Diamond Push-Ups",
  "Bodyweight Squats",
  "Reverse Lunges",
  "Plank",
  "Mountain Climbers",
  "Bicycle Crunch",
  "Dumbbell Rows",
  "Bicep Curls",
  "Lateral Raises",
] as const;

describe("exercise animation registry", () => {
  it("resolves a known stable exercise ID", () => {
    expect(
      resolveExerciseAnimation({
        exerciseId: "chest-bodyweight-push-up",
        exerciseName: "Renamed movement",
        intervalType: "work",
      }),
    ).toMatchObject({
      exerciseId: "chest-bodyweight-push-up",
      animationKey: "push-up-cycle",
      startPoseKey: "push-up-start",
      endPoseKey: "push-up-end",
      source: "exercise-id",
    });
  });

  it("normalizes exercise names for older name-only workout data", () => {
    expect(normalizeExerciseName("  BODYWEIGHT_squats  ")).toBe("bodyweight squats");
    expect(
      resolveExerciseAnimation({
        exerciseId: null,
        exerciseName: "  BODYWEIGHT_squats  ",
        intervalType: "warmup",
      }),
    ).toMatchObject({
      exerciseId: "legs-bodyweight-bodyweight-squat",
      animationKey: "squat-cycle",
      source: "exercise-name",
    });
  });

  it.each(supportedExerciseNames)("registers the initial exercise %s", (exerciseName) => {
    expect(
      resolveExerciseAnimation({ exerciseId: null, exerciseName, intervalType: "work" }).source,
    ).not.toBe("fallback");
  });

  it("uses the generic animated fallback for an unknown exercise", () => {
    expect(
      resolveExerciseAnimation({
        exerciseId: "core-bodyweight-dragon-flag",
        exerciseName: "Dragon Flag",
        intervalType: "work",
      }),
    ).toMatchObject({
      animationKey: "generic-cycle",
      startPoseKey: "generic-start",
      endPoseKey: "generic-end",
      source: "fallback",
    });
  });

  it("reports paused and resumed playback behavior", () => {
    const animation = resolveExerciseAnimation({
      exerciseId: "chest-bodyweight-push-up",
      exerciseName: "Push-Up",
      intervalType: "work",
    });

    expect(
      getExerciseAnimationPlaybackState({
        animation,
        isPaused: true,
        isVisible: true,
        reduceMotionEnabled: false,
      }),
    ).toBe("paused");
    expect(
      getExerciseAnimationPlaybackState({
        animation,
        isPaused: false,
        isVisible: true,
        reduceMotionEnabled: false,
      }),
    ).toBe("animating");
  });

  it("replaces the previous exercise with breathing motion during rest", () => {
    expect(
      resolveExerciseAnimation({
        exerciseId: "chest-bodyweight-push-up",
        exerciseName: "Push-Up",
        intervalType: " REST ",
      }),
    ).toMatchObject({
      exerciseId: "interval-rest",
      animationKey: "breathing-cycle",
      source: "rest",
    });
  });

  it("changes the render key when the active interval changes", () => {
    const pushUp = resolveExerciseAnimation({
      exerciseId: "chest-bodyweight-push-up",
      exerciseName: "Push-Up",
      intervalType: "work",
    });
    const squat = resolveExerciseAnimation({
      exerciseId: "legs-bodyweight-bodyweight-squat",
      exerciseName: "Bodyweight Squat",
      intervalType: "work",
    });

    expect(pushUp.renderKey).not.toBe(squat.renderKey);
  });

  it("uses a static start pose for reduced motion", () => {
    const animation = resolveExerciseAnimation({
      exerciseId: "full_body-bodyweight-mountain-climbers",
      exerciseName: "Mountain Climbers",
      intervalType: "burnout",
    });

    expect(animation.startPoseKey).toBe("mountain-climber-start");
    expect(
      getExerciseAnimationPlaybackState({
        animation,
        isPaused: false,
        isVisible: true,
        reduceMotionEnabled: true,
      }),
    ).toBe("reduced-motion");
  });

  it("stops motion while the active demonstration is off-screen", () => {
    const animation = resolveExerciseAnimation({
      exerciseId: null,
      exerciseName: "Push-Ups",
      intervalType: "work",
    });

    expect(
      getExerciseAnimationPlaybackState({
        animation,
        isPaused: false,
        isVisible: false,
        reduceMotionEnabled: false,
      }),
    ).toBe("paused");
  });

  it("keeps static fallbacks non-looping", () => {
    expect(EXERCISE_ANIMATION_REGISTRY["core-bodyweight-forearm-plank"]).toMatchObject({
      animationKey: "static",
      startPoseKey: "plank-static",
      loop: false,
    });
  });
});

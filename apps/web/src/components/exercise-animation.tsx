"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import {
  EXERCISE_ANIMATION_POSE_ASSETS,
  getExerciseAnimationPlaybackState,
  resolveExerciseAnimation,
} from "@/lib/exercise-animation";
import styles from "./exercise-animation.module.css";

export interface ExerciseAnimationProps {
  exerciseId: string | null | undefined;
  exerciseName: string;
  size: number;
  isPaused: boolean;
  intervalType: string;
  accessibilityLabel?: string;
}

type ExerciseAnimationStyle = CSSProperties & {
  "--exercise-animation-size": string;
  "--exercise-animation-duration": string;
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function subscribeToPageVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function getPageVisibilitySnapshot() {
  return document.visibilityState !== "hidden";
}

function useInViewport() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isInViewport, setIsInViewport] = useState(false);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const Observer = (
      window as unknown as { IntersectionObserver?: typeof IntersectionObserver }
    ).IntersectionObserver;
    if (!Observer) {
      const frame = window.requestAnimationFrame(() => setIsInViewport(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new Observer(
      ([entry]) => setIsInViewport(Boolean(entry?.isIntersecting)),
      { rootMargin: "80px 0px", threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [rootRef, isInViewport] as const;
}

function ExerciseAnimationComponent({
  exerciseId,
  exerciseName,
  size,
  isPaused,
  intervalType,
  accessibilityLabel,
}: ExerciseAnimationProps) {
  const animation = useMemo(
    () => resolveExerciseAnimation({ exerciseId, exerciseName, intervalType }),
    [exerciseId, exerciseName, intervalType],
  );
  const [rootRef, isInViewport] = useInViewport();
  const reduceMotionEnabled = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => true,
  );
  const isPageVisible = useSyncExternalStore(
    subscribeToPageVisibility,
    getPageVisibilitySnapshot,
    () => false,
  );
  const playbackState = getExerciseAnimationPlaybackState({
    animation,
    isPaused,
    isVisible: isInViewport && isPageVisible,
    reduceMotionEnabled,
  });
  const safeSize = Number.isFinite(size) ? Math.max(64, size) : 200;
  const cycleDuration = Math.max(360, Math.round(1800 / animation.playbackSpeed));
  const startPoseKey = animation.startPoseKey ?? "generic-start";
  const endPoseKey = animation.endPoseKey ?? startPoseKey;
  const hasMotion = animation.loop && startPoseKey !== endPoseKey;
  const label =
    accessibilityLabel ??
    (animation.source === "rest"
      ? "Rest interval breathing demonstration"
      : `${exerciseName.trim() || "Unknown exercise"} exercise demonstration`);
  const customProperties: ExerciseAnimationStyle = {
    "--exercise-animation-size": `${safeSize}px`,
    "--exercise-animation-duration": `${cycleDuration}ms`,
  };

  return (
    <div
      ref={rootRef}
      className={styles.root}
      role="img"
      aria-label={label}
      data-animation-key={animation.animationKey}
      data-playback-state={playbackState}
      data-has-motion={hasMotion}
      style={customProperties}
    >
      <div className={styles.frame} key={animation.renderKey} aria-hidden="true">
        <span
          className={`${styles.pose} ${styles.startPose}`}
          style={{ backgroundImage: `url(${EXERCISE_ANIMATION_POSE_ASSETS[startPoseKey]})` }}
        />
        {hasMotion ? (
          <span
            className={`${styles.pose} ${styles.endPose}`}
            style={{ backgroundImage: `url(${EXERCISE_ANIMATION_POSE_ASSETS[endPoseKey]})` }}
          />
        ) : null}
      </div>
    </div>
  );
}

export const ExerciseAnimation = memo(ExerciseAnimationComponent);

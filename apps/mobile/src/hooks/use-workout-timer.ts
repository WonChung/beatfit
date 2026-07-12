import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { GenerateWorkoutResponse } from '@/types/workout';
import {
  buildWorkoutTimeline,
  createWorkoutTimerState,
  getElapsedWorkoutTimeMs,
  getRemainingTimeMs,
  getTotalTimelineDurationMs,
  getWorkoutProgress,
  pauseWorkoutTimer,
  previousWorkoutInterval,
  reconcileWorkoutTimer,
  resumeWorkoutTimer,
  skipWorkoutInterval,
  startWorkoutTimer,
  type TimelineInterval,
  type WorkoutTimerState,
} from '@/timer/workout-timer';

interface UseWorkoutTimerOptions {
  onComplete: () => void;
}

export function useWorkoutTimer(
  workout: GenerateWorkoutResponse | null,
  { onComplete }: UseWorkoutTimerOptions
) {
  const timeline = useMemo(() => buildWorkoutTimeline(workout), [workout]);
  const [timerState, setTimerState] = useState(() => createWorkoutTimerState(timeline));
  const [nowMs, setNowMs] = useState(Date.now);
  const completionHandled = useRef(false);
  const previousIndex = useRef(timerState.currentIndex);

  const refresh = useCallback(
    (timestamp = Date.now()) => {
      setNowMs(timestamp);
      setTimerState((state) => reconcileWorkoutTimer(state, timeline, timestamp));
    },
    [timeline]
  );

  useEffect(() => {
    if (timerState.status !== 'running') return;
    const timer = setInterval(() => refresh(), 100);
    return () => clearInterval(timer);
  }, [refresh, timerState.status]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  useEffect(() => {
    if (timerState.currentIndex !== previousIndex.current) {
      previousIndex.current = timerState.currentIndex;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
  }, [timerState.currentIndex]);

  useEffect(() => {
    if (
      timeline.length > 0 &&
      timerState.status === 'completed' &&
      !completionHandled.current
    ) {
      completionHandled.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
      onComplete();
    }
  }, [onComplete, timeline.length, timerState.status]);

  const runTransition = useCallback(
    (
      transition: (
        state: WorkoutTimerState,
        timeline: TimelineInterval[],
        nowMs: number
      ) => WorkoutTimerState
    ) => {
      const timestamp = Date.now();
      setNowMs(timestamp);
      setTimerState((state) => transition(state, timeline, timestamp));
    },
    [timeline]
  );

  const start = useCallback(() => {
    const timestamp = Date.now();
    setNowMs(timestamp);
    setTimerState((state) => startWorkoutTimer(state, timestamp));
  }, []);

  const pause = useCallback(
    () => runTransition(pauseWorkoutTimer),
    [runTransition]
  );
  const resume = useCallback(() => {
    const timestamp = Date.now();
    setNowMs(timestamp);
    setTimerState((state) => resumeWorkoutTimer(state, timestamp));
  }, []);
  const skip = useCallback(() => runTransition(skipWorkoutInterval), [runTransition]);
  const previous = useCallback(
    () => runTransition(previousWorkoutInterval),
    [runTransition]
  );

  return {
    status: timerState.status,
    timeline,
    current: timeline[timerState.currentIndex] ?? null,
    next: timeline[timerState.currentIndex + 1] ?? null,
    currentIndex: timerState.currentIndex,
    remainingMs: getRemainingTimeMs(timerState, nowMs),
    elapsedMs: getElapsedWorkoutTimeMs(timerState, timeline, nowMs),
    totalDurationMs: getTotalTimelineDurationMs(timeline),
    progress: getWorkoutProgress(timerState, timeline, nowMs),
    start,
    pause,
    resume,
    skip,
    previous,
  };
}

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseAnimation } from '@/components/exercise-animation';
import { ExerciseVisual } from '@/components/exercise-visual';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useWorkoutTimer } from '@/hooks/use-workout-timer';
import { persistWorkoutSession } from '@/services/api';
import { useAuth } from '@/state/auth-store';
import { usePersistenceStore } from '@/state/persistence-store';
import { useWorkoutStore } from '@/state/workout-store';
import type { WorkoutTimerStatus } from '@/timer/workout-timer';
import { formatIntervalType, formatSeconds } from '@/utils/workout-format';
import { createWorkoutSession } from '@/utils/workout-session';

const TYPE_COLORS: Record<string, string> = {
  warmup: '#2563eb',
  work: '#16a34a',
  rest: '#64748b',
  burnout: '#ea580c',
};

export default function WorkoutPlayerScreen() {
  const router = useRouter();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const { session: authSession } = useAuth();
  const { recordSession } = usePersistenceStore();
  const { workout, saveSession } = useWorkoutStore();
  const sessionStartedAt = useRef<number | null>(null);
  const completedIndicesRef = useRef<number[]>([]);
  const handleComplete = useCallback(
    async (completedIndices: number[]) => {
      if (!workout) return;
      const endTimeMs = Date.now();
      let session = createWorkoutSession({
        workout,
        startTimeMs: sessionStartedAt.current ?? endTimeMs,
        endTimeMs,
        completedIndices,
        status: 'completed',
      });
      session = await syncSession(workout.workout_id, session, authSession?.access_token);
      saveSession(session);
      await recordSession(session).catch(() => undefined);
      router.replace('/workout-complete');
    },
    [authSession?.access_token, recordSession, router, saveSession, workout]
  );
  const timer = useWorkoutTimer(workout, { onComplete: handleComplete });
  useEffect(() => {
    completedIndicesRef.current = timer.completedIndices;
  }, [timer.completedIndices]);

  function handleStart() {
    sessionStartedAt.current ??= Date.now();
    timer.start();
  }

  async function finishEarly() {
    if (!workout) return;
    const endTimeMs = Date.now();
    let session = createWorkoutSession({
      workout,
      startTimeMs: sessionStartedAt.current ?? endTimeMs,
      endTimeMs,
      completedIndices: completedIndicesRef.current,
      status: 'ended_early',
    });
    session = await syncSession(workout.workout_id, session, authSession?.access_token);
    saveSession(session);
    await recordSession(session).catch(() => undefined);
    router.replace('/workout-complete');
  }

  function handleEndWorkout() {
    Alert.alert(
      'End workout?',
      'Your current workout progress will stop. You can cancel and keep exercising.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Workout',
          style: 'destructive',
          onPress: () => void finishEarly(),
        },
      ]
    );
  }

  if (!workout || timer.timeline.length === 0 || !timer.current) {
    return (
      <PlayerMessage
        title="No playable workout"
        message="This workout has no valid intervals. Return to the preview and generate it again."
        actionLabel="Back to Preview"
        onAction={() => (router.canGoBack() ? router.back() : router.dismissTo('/'))}
      />
    );
  }

  const intervalColor = TYPE_COLORS[timer.current.interval.type.toLowerCase()] ?? '#7c3aed';
  const remainingSeconds = Math.ceil(timer.remainingMs / 1000);
  const elapsedSeconds = Math.floor(timer.elapsedMs / 1000);
  const progressPercent = Math.round(timer.progress * 100);
  const animationSize = Math.min(
    220,
    Math.max(40, viewportWidth - Spacing.four * 2),
    Math.max(120, viewportHeight * 0.28)
  );

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.songHeader}>
            <View style={styles.songCopy}>
              <ThemedText type="small" themeColor="textSecondary">
                Song {timer.current.blockIndex + 1} of {workout.blocks.length}
              </ThemedText>
              <ThemedText type="subtitle" accessibilityRole="header">
                {timer.current.song.title}
              </ThemedText>
              <ThemedText themeColor="textSecondary">{timer.current.song.artist}</ThemedText>
            </View>
            <View style={[styles.typeBadge, { borderColor: intervalColor }]}>
              <ThemedText type="smallBold" style={{ color: intervalColor }}>
                {formatIntervalType(timer.current.interval.type)}
              </ThemedText>
            </View>
          </View>

          <View style={styles.timerSection}>
            <ThemedText themeColor="textSecondary">Current exercise</ThemedText>
            <ThemedText type="subtitle" style={styles.exerciseName}>
              {timer.current.interval.exercise}
            </ThemedText>
            <View style={styles.currentExerciseVisual}>
              <ExerciseAnimation
                exerciseId={timer.current.interval.exercise_id}
                exerciseName={timer.current.interval.exercise}
                intervalType={timer.current.interval.type}
                size={animationSize}
                isPaused={timer.status !== 'running'}
              />
            </View>
            <ThemedText
              accessibilityLabel={`${remainingSeconds} seconds remaining`}
              style={[styles.countdown, { color: intervalColor }]}>
              {formatSeconds(remainingSeconds)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              remaining
            </ThemedText>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
              <ThemedText type="small">Elapsed {formatSeconds(elapsedSeconds)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {progressPercent}%
              </ThemedText>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
              style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          <ThemedView type="backgroundElement" style={styles.nextCard}>
            <ThemedText type="small" themeColor="textSecondary">
              Up next
            </ThemedText>
            <View style={styles.nextContent}>
              {timer.next && timer.next.interval.type.trim().toLowerCase() !== 'rest' ? (
                <View style={styles.nextVisual}>
                  <ExerciseVisual
                    exerciseName={timer.next.interval.exercise}
                    size={56}
                    showLabel={false}
                  />
                </View>
              ) : null}
              <View style={styles.nextCopy}>
                <ThemedText type="smallBold">
                  {timer.next ? timer.next.interval.exercise : 'Workout complete'}
                </ThemedText>
                {timer.next && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatIntervalType(timer.next.interval.type)} ·{' '}
                    {formatSeconds(Math.ceil(timer.next.durationMs / 1000))}
                  </ThemedText>
                )}
              </View>
            </View>
          </ThemedView>

          <View style={styles.controls}>
            <PrimaryTimerControl
              status={timer.status}
              onStart={handleStart}
              onPause={timer.pause}
              onResume={timer.resume}
            />
            <View style={styles.navigationControls}>
              <ControlButton
                label="Previous"
                onPress={timer.previous}
                disabled={timer.currentIndex === 0}
              />
              <ControlButton label="Skip Interval" onPress={timer.skip} />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={handleEndWorkout}
              style={({ pressed }) => [styles.endButton, { opacity: pressed ? 0.65 : 1 }]}>
              <ThemedText type="smallBold" style={styles.endButtonText}>
                End Workout
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

async function syncSession(
  workoutId: string | null | undefined,
  session: ReturnType<typeof createWorkoutSession>,
  accessToken: string | undefined
) {
  if (!workoutId || !accessToken) {
    return {
      ...session,
      remoteSyncError: 'This session was saved on this device, but not to your BeatFit account.',
    };
  }
  try {
    return {
      ...session,
      serverSessionId: await persistWorkoutSession(workoutId, session, accessToken),
    };
  } catch (caughtError) {
    return {
      ...session,
      remoteSyncError:
        caughtError instanceof Error
          ? `Account sync failed: ${caughtError.message}`
          : 'Account sync failed. This session is still saved on this device.',
    };
  }
}

function PrimaryTimerControl({
  status,
  onStart,
  onPause,
  onResume,
}: {
  status: WorkoutTimerStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const action =
    status === 'ready'
      ? { label: 'Start', onPress: onStart }
      : status === 'paused'
        ? { label: 'Resume', onPress: onResume }
        : { label: 'Pause', onPress: onPause };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={action.onPress}
      style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.65 : 1 }]}>
      <ThemedText type="smallBold" style={styles.primaryButtonText}>
        {action.label}
      </ThemedText>
    </Pressable>
  );
}

function ControlButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlButton,
        { opacity: pressed || disabled ? 0.45 : 1 },
      ]}>
      <ThemedText type="smallBold" style={styles.controlButtonText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function PlayerMessage({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.messageScreen}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {message}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.65 : 1 }]}>
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  songHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  songCopy: { flex: 1, gap: Spacing.one },
  typeBadge: {
    minHeight: 36,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
  },
  timerSection: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.three },
  exerciseName: { textAlign: 'center' },
  currentExerciseVisual: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.one,
  },
  countdown: { fontSize: 76, lineHeight: 88, fontWeight: '700', fontVariant: ['tabular-nums'] },
  progressSection: { gap: Spacing.two },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressTrack: {
    height: 12,
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: '#d1d5db',
  },
  progressFill: { height: '100%', borderRadius: 6, backgroundColor: '#2563eb' },
  nextCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  nextContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  nextVisual: { flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  nextCopy: { flex: 1, gap: Spacing.one },
  controls: { gap: Spacing.two },
  primaryButton: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#2563eb',
    paddingHorizontal: Spacing.three,
  },
  primaryButtonText: { color: '#ffffff' },
  navigationControls: { flexDirection: 'row', gap: Spacing.two },
  controlButton: {
    flex: 1,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  controlButtonText: { color: '#2563eb' },
  endButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  endButtonText: { color: '#dc2626' },
  messageScreen: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  centeredText: { textAlign: 'center' },
});

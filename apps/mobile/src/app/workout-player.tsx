import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useWorkoutTimer } from '@/hooks/use-workout-timer';
import { useWorkoutStore } from '@/state/workout-store';
import type { WorkoutTimerStatus } from '@/timer/workout-timer';
import { formatIntervalType, formatSeconds } from '@/utils/workout-format';

const TYPE_COLORS: Record<string, string> = {
  warmup: '#2563eb',
  work: '#16a34a',
  rest: '#64748b',
  burnout: '#ea580c',
};

export default function WorkoutPlayerScreen() {
  const router = useRouter();
  const { workout } = useWorkoutStore();
  const handleComplete = useCallback(
    () => router.replace('/workout-complete?status=completed'),
    [router]
  );
  const timer = useWorkoutTimer(workout, { onComplete: handleComplete });

  function handleEndWorkout() {
    Alert.alert(
      'End workout?',
      'Your current workout progress will stop. You can cancel and keep exercising.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Workout',
          style: 'destructive',
          onPress: () => router.replace('/workout-complete?status=ended-early'),
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
            <ThemedText type="smallBold">
              {timer.next ? timer.next.interval.exercise : 'Workout complete'}
            </ThemedText>
            {timer.next && (
              <ThemedText type="small" themeColor="textSecondary">
                {formatIntervalType(timer.next.interval.type)} ·{' '}
                {formatSeconds(Math.ceil(timer.next.durationMs / 1000))}
              </ThemedText>
            )}
          </ThemedView>

          <View style={styles.controls}>
            <PrimaryTimerControl
              status={timer.status}
              onStart={timer.start}
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
  timerSection: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.four },
  exerciseName: { textAlign: 'center' },
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

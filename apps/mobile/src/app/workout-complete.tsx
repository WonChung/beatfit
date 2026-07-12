import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useWorkoutStore } from '@/state/workout-store';
import type { WorkoutFeedback } from '@/types/workout';
import { formatMuscleGroup, formatSeconds, toReadableLabel } from '@/utils/workout-format';
import {
  calculateCompletionPercentage,
  getPlannedVsActualDuration,
} from '@/utils/workout-session';

const FEEDBACK_OPTIONS: readonly { label: string; value: WorkoutFeedback }[] = [
  { label: 'Too easy', value: 'too_easy' },
  { label: 'About right', value: 'about_right' },
  { label: 'Too hard', value: 'too_hard' },
];

export default function WorkoutCompleteScreen() {
  const router = useRouter();
  const { session, clearSession, setSessionFeedback } = useWorkoutStore();

  if (!session) {
    return (
      <CompletionMessage
        title="No workout summary"
        message="Complete or end a workout to see its session summary."
        actionLabel="Return Home"
        onAction={() => router.dismissTo('/')}
      />
    );
  }

  const completionPercentage = calculateCompletionPercentage(
    session.completedIntervals,
    session.totalIntervals
  );
  const durationComparison = getPlannedVsActualDuration(session);
  const endedEarly = session.status === 'ended_early';

  function handleRepeatWorkout() {
    clearSession();
    router.replace('/workout-player');
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View
              style={[
                styles.statusBadge,
                endedEarly ? styles.endedBadge : styles.completedBadge,
              ]}>
              <ThemedText
                type="smallBold"
                style={endedEarly ? styles.endedText : styles.completedText}>
                {endedEarly ? 'Ended early' : 'Completed'}
              </ThemedText>
            </View>
            <ThemedText type="subtitle" accessibilityRole="header" style={styles.centeredText}>
              {endedEarly ? 'Workout Ended' : 'Workout Complete'}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centeredText}>
              {endedEarly
                ? 'Here is the progress you made before ending the session.'
                : 'You completed the workout. Great work!'}
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.summaryCard}>
            <SummaryRow
              label="Muscle group"
              value={formatMuscleGroup(session.workout.muscle_group)}
            />
            <SummaryRow label="Difficulty" value={toReadableLabel(session.workout.difficulty)} />
            <SummaryRow
              label="Equipment"
              value={session.workout.equipment.map(toReadableLabel).join(', ') || 'None'}
            />
            <SummaryRow
              label="Planned duration"
              value={formatSeconds(Math.round(session.plannedDurationSeconds))}
            />
            <SummaryRow
              label="Actual duration"
              value={formatSeconds(Math.round(session.actualElapsedDurationSeconds))}
            />
            <SummaryRow
              label="Songs completed"
              value={`${session.completedSongBlocks} of ${session.workout.blocks.length}`}
            />
            <SummaryRow
              label="Intervals completed"
              value={`${session.completedIntervals} of ${session.totalIntervals}`}
            />
            <SummaryRow
              label="Work intervals"
              value={String(session.completedWorkIntervals)}
            />
            <SummaryRow
              label="Completion"
              value={`${Math.round(completionPercentage)}%`}
            />
          </ThemedView>

          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            {formatDurationDifference(durationComparison.differenceSeconds)}
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.feedbackCard}>
            <ThemedText type="smallBold">How did that workout feel?</ThemedText>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Workout feedback"
              style={styles.feedbackOptions}>
              {FEEDBACK_OPTIONS.map((option) => {
                const selected = session.feedback === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setSessionFeedback(option.value)}
                    style={({ pressed }) => [
                      styles.feedbackButton,
                      selected && styles.feedbackButtonSelected,
                      { opacity: pressed ? 0.65 : 1 },
                    ]}>
                    <ThemedText
                      type="smallBold"
                      style={selected ? styles.feedbackTextSelected : undefined}>
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ThemedView>

          <View style={styles.actions}>
            <ActionButton label="Repeat Workout" variant="primary" onPress={handleRepeatWorkout} />
            <ActionButton
              label="Generate Another Workout"
              onPress={() => router.dismissTo('/')}
            />
            <ActionButton label="Return Home" onPress={() => router.dismissTo('/')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.summaryLabel}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.summaryValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  variant = 'secondary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
        { opacity: pressed ? 0.65 : 1 },
      ]}>
      <ThemedText
        type="smallBold"
        style={variant === 'primary' ? styles.primaryButtonText : styles.secondaryButtonText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function CompletionMessage({
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
        <ThemedText type="subtitle" accessibilityRole="header" style={styles.centeredText}>
          {title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {message}
        </ThemedText>
        <ActionButton label={actionLabel} variant="primary" onPress={onAction} />
      </SafeAreaView>
    </ThemedView>
  );
}

function formatDurationDifference(differenceSeconds: number): string {
  const roundedDifference = Math.round(differenceSeconds);
  if (roundedDifference === 0) return 'Actual time matched the planned duration.';
  const direction = roundedDifference > 0 ? 'longer' : 'shorter';
  return `Actual session was ${formatSeconds(Math.abs(roundedDifference))} ${direction} than planned.`;
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
  header: { alignItems: 'center', gap: Spacing.two },
  centeredText: { textAlign: 'center' },
  statusBadge: {
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
  },
  completedBadge: { backgroundColor: '#16a34a20' },
  completedText: { color: '#16a34a' },
  endedBadge: { backgroundColor: '#ea580c20' },
  endedText: { color: '#ea580c' },
  summaryCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.three },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  summaryLabel: { flex: 1 },
  summaryValue: { flex: 1, textAlign: 'right' },
  feedbackCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.three },
  feedbackOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  feedbackButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  feedbackButtonSelected: { backgroundColor: '#2563eb' },
  feedbackTextSelected: { color: '#ffffff' },
  actions: { gap: Spacing.two },
  actionButton: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  primaryButton: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  secondaryButton: { borderColor: '#2563eb' },
  primaryButtonText: { color: '#ffffff' },
  secondaryButtonText: { color: '#2563eb' },
  messageScreen: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
});

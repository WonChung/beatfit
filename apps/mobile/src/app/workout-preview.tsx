import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseVisual } from '@/components/exercise-visual';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { generatePersonalizedWorkout } from '@/services/api';
import { useAuth } from '@/state/auth-store';
import { usePersistenceStore } from '@/state/persistence-store';
import { useWorkoutStore } from '@/state/workout-store';
import type { WorkoutBlock, WorkoutInterval } from '@/types/workout';
import {
  formatIntervalType,
  formatMuscleGroup,
  formatSeconds,
  formatTotalWorkoutDuration,
  toReadableLabel,
} from '@/utils/workout-format';

const INTERVAL_COLORS: Record<string, { backgroundColor: string; borderColor: string }> = {
  warmup: { backgroundColor: '#2563eb20', borderColor: '#2563eb' },
  work: { backgroundColor: '#16a34a20', borderColor: '#16a34a' },
  rest: { backgroundColor: '#64748b20', borderColor: '#64748b' },
  burnout: { backgroundColor: '#ea580c20', borderColor: '#ea580c' },
};

const FALLBACK_INTERVAL_COLORS = {
  backgroundColor: '#7c3aed20',
  borderColor: '#7c3aed',
};

export default function WorkoutPreviewScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const {
    error: storageError,
    recordGeneratedWorkout,
    saveNamedWorkout,
  } = usePersistenceStore();
  const { request, workout, replaceWorkout } = useWorkoutStore();
  const regenerationInProgress = useRef(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerationError, setRegenerationError] = useState<string | null>(null);
  const [workoutName, setWorkoutName] = useState('My BeatFit Workout');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPersonalizationDetails, setShowPersonalizationDetails] = useState(false);

  async function handleGenerateAgain() {
    if (!request || regenerationInProgress.current) return;

    regenerationInProgress.current = true;
    setIsRegenerating(true);
    setRegenerationError(null);
    try {
      if (!session?.access_token) throw new Error('Your session expired. Sign in again.');
      const regeneratedWorkout = await generatePersonalizedWorkout(request, session.access_token);
      replaceWorkout(regeneratedWorkout);
      await recordGeneratedWorkout(request, regeneratedWorkout).catch(() => undefined);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'An unexpected error occurred.';
      setRegenerationError(message);
    } finally {
      regenerationInProgress.current = false;
      setIsRegenerating(false);
    }
  }

  async function handleSaveWorkout() {
    if (!request || !workout || isSaving) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await saveNamedWorkout(workoutName, request, workout);
      setSaveMessage('Workout saved.');
    } catch (caughtError) {
      setSaveMessage(caughtError instanceof Error ? caughtError.message : 'Could not save workout.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!request || !workout) {
    return (
      <EmptyState
        title="No workout to preview"
        message="Generate a workout from the setup screen first."
        actionLabel="Go to Setup"
        onAction={() => router.dismissTo('/')}
      />
    );
  }

  const hasPlayableIntervals = workout.blocks.some((block) => block.intervals.length > 0);

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heading}>
            <ThemedText type="subtitle" accessibilityRole="header">
              Workout Preview
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Review the generated plan before starting.
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.summaryCard}>
            <SummaryItem label="Muscle group" value={formatMuscleGroup(workout.muscle_group)} />
            <SummaryItem label="Difficulty" value={toReadableLabel(workout.difficulty)} />
            <SummaryItem label="Goal" value={toReadableLabel(workout.goal ?? request.goal ?? 'endurance')} />
            <SummaryItem
              label="Equipment"
              value={workout.equipment.map(toReadableLabel).join(', ') || 'None'}
            />
            <SummaryItem label="Total duration" value={formatTotalWorkoutDuration(workout)} />
          </ThemedView>

          {workout.personalization ? (
            <ThemedView type="backgroundElement" style={styles.personalizationCard}>
              <View style={styles.personalizationHeading}>
                <ThemedText type="smallBold">Why this workout?</ThemedText>
                {workout.personalization.personalized ? (
                  <View style={styles.adjustedBadge}>
                    <ThemedText type="smallBold" style={styles.adjustedBadgeText}>
                      Adjusted for you
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText>{workout.personalization.summary}</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showPersonalizationDetails }}
                onPress={() => setShowPersonalizationDetails((visible) => !visible)}
                style={styles.whyButton}>
                <ThemedText type="smallBold" style={styles.secondaryButtonText}>
                  {showPersonalizationDetails ? 'Hide details' : 'View why adjusted'}
                </ThemedText>
              </Pressable>
              {showPersonalizationDetails ? (
                <View style={styles.explanationDetails}>
                  {workout.personalization.adjustments.length > 0 ? (
                    workout.personalization.adjustments.map((adjustment, index) => (
                      <ThemedText key={`${adjustment}-${index}`} type="small">
                        • {adjustment}
                      </ThemedText>
                    ))
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      No feedback-based timing or difficulty adjustment was needed.
                    </ThemedText>
                  )}
                  <ThemedText type="small" themeColor="textSecondary">
                    {workout.personalization.history_sessions_considered} recent feedback session
                    {workout.personalization.history_sessions_considered === 1 ? '' : 's'} considered
                    {workout.personalization.feedback_signal
                      ? ` · signal: ${toReadableLabel(workout.personalization.feedback_signal)}`
                      : ''}
                  </ThemedText>
                </View>
              ) : null}
            </ThemedView>
          ) : null}

          {workout.blocks.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.messageCard}>
              <ThemedText type="smallBold">No workout blocks were generated.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Try generating the workout again or edit the setup.
              </ThemedText>
            </ThemedView>
          ) : (
            workout.blocks.map((block, index) => (
              <WorkoutBlockPreview
                block={block}
                index={index}
                key={`${block.song.title}-${block.song.duration_ms}-${index}`}
              />
            ))
          )}

          {regenerationError && (
            <ThemedText accessibilityRole="alert" style={styles.errorText}>
              {regenerationError}
            </ThemedText>
          )}
          {storageError && (
            <ThemedText accessibilityRole="alert" style={styles.errorText}>
              Local storage: {storageError}
            </ThemedText>
          )}

          <ThemedView type="backgroundElement" style={styles.saveCard}>
            <ThemedText type="smallBold">Save this workout</ThemedText>
            <TextInput
              accessibilityLabel="Saved workout name"
              value={workoutName}
              onChangeText={setWorkoutName}
              placeholder="Workout name"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.nameInput,
                {
                  color: theme.text,
                  backgroundColor: theme.background,
                  borderColor: theme.backgroundSelected,
                },
              ]}
            />
            <ActionButton
              label={isSaving ? 'Saving…' : 'Save Workout'}
              onPress={handleSaveWorkout}
              loading={isSaving}
              disabled={isSaving}
            />
            {saveMessage && (
              <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                {saveMessage}
              </ThemedText>
            )}
          </ThemedView>

          <View style={styles.actions}>
            <ActionButton
              label="Start Workout"
              variant="primary"
              disabled={!hasPlayableIntervals}
              onPress={() => router.push('/workout-player')}
            />
            <ActionButton
              label={isRegenerating ? 'Generating…' : 'Generate Again'}
              onPress={handleGenerateAgain}
              disabled={isRegenerating}
              loading={isRegenerating}
            />
            <ActionButton label="Edit Setup" onPress={() => router.dismissTo('/')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.summaryValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function WorkoutBlockPreview({ block, index }: { block: WorkoutBlock; index: number }) {
  return (
    <ThemedView type="backgroundElement" style={styles.blockCard}>
      <View style={styles.songHeader}>
        <View style={styles.songDetails}>
          <ThemedText type="small" themeColor="textSecondary">
            Song {index + 1}
          </ThemedText>
          <ThemedText type="smallBold">{block.song.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {block.song.artist}
          </ThemedText>
        </View>
        <ThemedText type="smallBold">{formatSeconds(block.duration_seconds)}</ThemedText>
      </View>

      {block.intervals.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No intervals were generated for this song.
        </ThemedText>
      ) : (
        <View style={styles.intervalList}>
          {block.intervals.map((interval, intervalIndex) => (
            <IntervalPreview
              interval={interval}
              key={`${interval.start_seconds}-${interval.end_seconds}-${intervalIndex}`}
            />
          ))}
        </View>
      )}
    </ThemedView>
  );
}

function IntervalPreview({ interval }: { interval: WorkoutInterval }) {
  const normalizedType = interval.type.trim().toLowerCase();
  const colors = INTERVAL_COLORS[normalizedType] ?? FALLBACK_INTERVAL_COLORS;

  return (
    <View
      style={[
        styles.intervalCard,
        { backgroundColor: colors.backgroundColor, borderLeftColor: colors.borderColor },
      ]}>
      {normalizedType !== 'rest' ? (
        <View style={styles.intervalVisual}>
          <ExerciseVisual exerciseName={interval.exercise} size={52} showLabel={false} />
        </View>
      ) : null}
      <View style={styles.intervalDetails}>
        <View style={styles.intervalMetadata}>
          <ThemedText type="smallBold" style={{ color: colors.borderColor }}>
            {formatIntervalType(interval.type)}
          </ThemedText>
          <ThemedText type="code">
            {formatSeconds(interval.start_seconds)}–{formatSeconds(interval.end_seconds)}
          </ThemedText>
        </View>
        <ThemedText>{interval.exercise}</ThemedText>
      </View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  variant = 'secondary',
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
        { opacity: pressed || disabled ? 0.65 : 1 },
      ]}>
      {loading && <ActivityIndicator color={variant === 'primary' ? '#ffffff' : '#2563eb'} />}
      <ThemedText
        type="smallBold"
        style={variant === 'primary' ? styles.primaryButtonText : styles.secondaryButtonText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function EmptyState({
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
      <SafeAreaView style={styles.emptyState}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.emptyMessage}>
          {message}
        </ThemedText>
        <ActionButton label={actionLabel} variant="primary" onPress={onAction} />
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
  heading: { gap: Spacing.one },
  summaryCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  summaryItem: { minWidth: '45%', flex: 1, gap: Spacing.one },
  summaryValue: { flexShrink: 1 },
  messageCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  blockCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.three },
  songHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  songDetails: { flex: 1, gap: Spacing.one },
  intervalList: { gap: Spacing.two },
  intervalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    padding: Spacing.three,
    borderLeftWidth: 4,
    borderRadius: Spacing.two,
    gap: Spacing.three,
  },
  intervalDetails: { flex: 1, gap: Spacing.one },
  intervalMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  intervalVisual: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: Spacing.two },
  saveCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  personalizationCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  personalizationHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  adjustedBadge: {
    backgroundColor: '#2563eb',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  adjustedBadgeText: { color: '#ffffff' },
  whyButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  explanationDetails: { gap: Spacing.one },
  nameInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  actionButton: {
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  primaryButton: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  secondaryButton: { backgroundColor: 'transparent', borderColor: '#2563eb' },
  primaryButtonText: { color: '#ffffff' },
  secondaryButtonText: { color: '#2563eb' },
  errorText: { color: '#dc2626' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  emptyMessage: { marginBottom: Spacing.one },
});

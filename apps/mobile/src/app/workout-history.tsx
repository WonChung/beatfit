import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePersistenceStore } from '@/state/persistence-store';
import type { WorkoutFeedback } from '@/types/workout';
import { formatMuscleGroup, formatSeconds, toReadableLabel } from '@/utils/workout-format';
import { calculateCompletionPercentage } from '@/utils/workout-session';

const FEEDBACK_LABELS: Record<WorkoutFeedback, string> = {
  too_easy: 'Too easy',
  about_right: 'About right',
  too_hard: 'Too hard',
};

export default function WorkoutHistoryScreen() {
  const router = useRouter();
  const { sessions, isLoading, error, refresh } = usePersistenceStore();
  const orderedSessions = [...sessions].sort((a, b) => b.endTime.localeCompare(a.endTime));

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingState}>
        <ActivityIndicator color="#2563eb" />
        <ThemedText themeColor="textSecondary">Loading workout history…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="subtitle" accessibilityRole="header">
              Workout History
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Completed and ended-early sessions stored on this device.
            </ThemedText>
          </View>

          {error && (
            <ThemedView type="backgroundElement" style={styles.messageCard}>
              <ThemedText accessibilityRole="alert" style={styles.errorText}>
                {error}
              </ThemedText>
              <HistoryButton label="Try Again" onPress={() => void refresh().catch(() => undefined)} />
            </ThemedView>
          )}

          {orderedSessions.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.messageCard}>
              <ThemedText type="smallBold">No workout history yet</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Completed and ended-early workouts will appear here.
              </ThemedText>
              <HistoryButton label="Return Home" onPress={() => router.dismissTo('/')} />
            </ThemedView>
          ) : (
            orderedSessions.map((session) => {
              const percentage = calculateCompletionPercentage(
                session.completedIntervals,
                session.totalIntervals
              );
              return (
                <ThemedView type="backgroundElement" style={styles.sessionCard} key={session.id}>
                  <View style={styles.sessionHeader}>
                    <View style={styles.sessionTitle}>
                      <ThemedText type="smallBold">
                        {formatMuscleGroup(session.workout.muscle_group)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatSessionDate(session.endTime)} ·{' '}
                        {toReadableLabel(session.workout.difficulty)}
                      </ThemedText>
                    </View>
                    <ThemedText
                      type="smallBold"
                      style={
                        session.status === 'completed' ? styles.completedText : styles.endedText
                      }>
                      {session.status === 'completed' ? 'Completed' : 'Ended early'}
                    </ThemedText>
                  </View>
                  <View style={styles.statsGrid}>
                    <HistoryStat
                      label="Planned"
                      value={formatSeconds(Math.round(session.plannedDurationSeconds))}
                    />
                    <HistoryStat
                      label="Actual"
                      value={formatSeconds(Math.round(session.actualElapsedDurationSeconds))}
                    />
                    <HistoryStat label="Completion" value={`${Math.round(percentage)}%`} />
                    <HistoryStat
                      label="Feedback"
                      value={session.feedback ? FEEDBACK_LABELS[session.feedback] : 'Not provided'}
                    />
                  </View>
                </ThemedView>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function HistoryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

function HistoryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}>
      <ThemedText type="smallBold" style={styles.buttonText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function formatSessionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
    gap: Spacing.three,
  },
  header: { gap: Spacing.one },
  messageCard: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.two },
  errorText: { color: '#dc2626' },
  sessionCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.three },
  sessionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  sessionTitle: { flex: 1, gap: Spacing.one },
  completedText: { color: '#16a34a' },
  endedText: { color: '#ea580c' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  stat: { minWidth: '42%', flex: 1, gap: Spacing.one },
  button: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  buttonText: { color: '#2563eb' },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.two },
});

import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePersistenceStore } from '@/state/persistence-store';
import { useWorkoutStore } from '@/state/workout-store';
import type { SavedWorkout } from '@/types/persistence';
import {
  formatMuscleGroup,
  formatTotalWorkoutDuration,
  toReadableLabel,
} from '@/utils/workout-format';

export default function SavedWorkoutsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { saveGeneration } = useWorkoutStore();
  const {
    savedWorkouts,
    isLoading,
    error,
    refresh,
    renameSavedWorkout,
    toggleSavedWorkoutFavorite,
    deleteSavedWorkout,
  } = usePersistenceStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const orderedWorkouts = [...savedWorkouts].sort(
    (a, b) => Number(b.isFavorite) - Number(a.isFavorite) || b.updatedAt.localeCompare(a.updatedAt)
  );

  function repeatWorkout(savedWorkout: SavedWorkout) {
    saveGeneration(savedWorkout.request, savedWorkout.workout);
    router.push('/workout-preview');
  }

  async function runAction(id: string, action: () => Promise<void>) {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : 'Storage operation failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRename(id: string) {
    await runAction(id, () => renameSavedWorkout(id, nameDraft));
    setEditingId(null);
  }

  function confirmDelete(savedWorkout: SavedWorkout) {
    Alert.alert('Delete saved workout?', `"${savedWorkout.name}" will be removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void runAction(savedWorkout.id, () => deleteSavedWorkout(savedWorkout.id)),
      },
    ]);
  }

  if (isLoading) return <LoadingState label="Loading saved workouts…" />;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="subtitle" accessibilityRole="header">
              Saved Workouts
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Your named workouts are stored locally on this device.
            </ThemedText>
          </View>

          {(error || actionError) && (
            <ThemedView type="backgroundElement" style={styles.errorCard}>
              <ThemedText accessibilityRole="alert" style={styles.errorText}>
                {actionError ?? error}
              </ThemedText>
              <SmallButton label="Try Again" onPress={() => void refresh().catch(() => undefined)} />
            </ThemedView>
          )}

          {orderedWorkouts.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText type="smallBold">No saved workouts yet</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Generate a workout, then save it from the preview screen.
              </ThemedText>
              <SmallButton label="Generate Workout" onPress={() => router.dismissTo('/')} />
            </ThemedView>
          ) : (
            orderedWorkouts.map((savedWorkout) => (
              <ThemedView type="backgroundElement" style={styles.workoutCard} key={savedWorkout.id}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitle}>
                    {editingId === savedWorkout.id ? (
                      <TextInput
                        accessibilityLabel="New workout name"
                        autoFocus
                        value={nameDraft}
                        onChangeText={setNameDraft}
                        style={[
                          styles.nameInput,
                          {
                            color: theme.text,
                            backgroundColor: theme.background,
                            borderColor: theme.backgroundSelected,
                          },
                        ]}
                      />
                    ) : (
                      <ThemedText type="smallBold">{savedWorkout.name}</ThemedText>
                    )}
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatMuscleGroup(savedWorkout.workout.muscle_group)} ·{' '}
                      {toReadableLabel(savedWorkout.workout.difficulty)}
                    </ThemedText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={savedWorkout.isFavorite ? 'Remove favorite' : 'Add favorite'}
                    disabled={busyId === savedWorkout.id}
                    onPress={() =>
                      void runAction(savedWorkout.id, () =>
                        toggleSavedWorkoutFavorite(savedWorkout.id)
                      )
                    }
                    style={styles.favoriteButton}>
                    <ThemedText style={styles.favoriteText}>
                      {savedWorkout.isFavorite ? '★' : '☆'}
                    </ThemedText>
                  </Pressable>
                </View>

                <View style={styles.metadata}>
                  <ThemedText type="small">{savedWorkout.workout.blocks.length} songs</ThemedText>
                  <ThemedText type="small">
                    {formatTotalWorkoutDuration(savedWorkout.workout)}
                  </ThemedText>
                  <ThemedText type="small">
                    {savedWorkout.isFavorite ? 'Favorite' : 'Not favorite'}
                  </ThemedText>
                </View>

                <View style={styles.cardActions}>
                  {editingId === savedWorkout.id ? (
                    <>
                      <SmallButton
                        label="Save Name"
                        disabled={busyId === savedWorkout.id}
                        onPress={() => void confirmRename(savedWorkout.id)}
                      />
                      <SmallButton label="Cancel" onPress={() => setEditingId(null)} />
                    </>
                  ) : (
                    <>
                      <SmallButton label="Repeat" onPress={() => repeatWorkout(savedWorkout)} />
                      <SmallButton
                        label="Rename"
                        onPress={() => {
                          setEditingId(savedWorkout.id);
                          setNameDraft(savedWorkout.name);
                        }}
                      />
                      <SmallButton label="Delete" destructive onPress={() => confirmDelete(savedWorkout)} />
                    </>
                  )}
                </View>
              </ThemedView>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function SmallButton({
  label,
  onPress,
  disabled = false,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.smallButton, { opacity: pressed || disabled ? 0.5 : 1 }]}>
      <ThemedText type="smallBold" style={destructive ? styles.deleteText : styles.buttonText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <ThemedView style={styles.loadingState}>
      <ActivityIndicator color="#2563eb" />
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
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
    gap: Spacing.three,
  },
  header: { gap: Spacing.one },
  errorCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  errorText: { color: '#dc2626' },
  emptyCard: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.two },
  workoutCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.three },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  cardTitle: { flex: 1, gap: Spacing.one },
  favoriteButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  favoriteText: { color: '#f59e0b', fontSize: 28 },
  nameInput: { minHeight: 44, borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.two },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  smallButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  buttonText: { color: '#2563eb' },
  deleteText: { color: '#dc2626' },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.two },
});

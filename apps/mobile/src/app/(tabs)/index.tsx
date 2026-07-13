import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { generatePersonalizedWorkout } from '@/services/api';
import { spotifyMusicService } from '@/services/spotify';
import { usePersistenceStore } from '@/state/persistence-store';
import { usePreferences } from '@/state/preferences-store';
import { useWorkoutStore } from '@/state/workout-store';
import { useAuth } from '@/state/auth-store';
import type {
  Difficulty,
  Equipment,
  GenerateWorkoutRequest,
  MuscleGroup,
  UserPreferences,
  WorkoutGoal,
} from '@/types/workout';
import { preferencesToSetupDefaults, toggleEquipment } from '@/utils/preferences';
import {
  durationToMilliseconds,
  validateWorkoutForm,
  type WorkoutFormErrors,
} from '@/utils/workout-form';

const MUSCLE_GROUPS: readonly { label: string; value: MuscleGroup }[] = [
  { label: 'Chest', value: 'chest' },
  { label: 'Back', value: 'back' },
  { label: 'Legs', value: 'legs' },
  { label: 'Shoulders', value: 'shoulders' },
  { label: 'Arms', value: 'arms' },
  { label: 'Core', value: 'core' },
  { label: 'Full body', value: 'full_body' },
];

const DIFFICULTIES: readonly { label: string; value: Difficulty }[] = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Advanced', value: 'advanced' },
];

const EQUIPMENT: readonly { label: string; value: Equipment }[] = [
  { label: 'Bodyweight', value: 'bodyweight' },
  { label: 'Dumbbells', value: 'dumbbells' },
  { label: 'Gym', value: 'gym' },
];

const GOALS: readonly { label: string; value: WorkoutGoal }[] = [
  { label: 'Strength', value: 'strength' },
  { label: 'Pump', value: 'pump' },
  { label: 'Endurance', value: 'endurance' },
  { label: 'Cardio', value: 'cardio' },
];

export default function HomeScreen() {
  const { request } = useWorkoutStore();
  const { preferences, isLoading, error } = usePreferences();

  if (!request && isLoading) {
    return (
      <ThemedView style={styles.loadingScreen}>
        <ActivityIndicator size="large" accessibilityLabel="Loading workout preferences" />
        <ThemedText themeColor="textSecondary">Loading your workout preferences…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <WorkoutSetupScreen
      key={`${request ? 'existing-setup' : 'default-setup'}-${preferences?.updated_at ?? 'defaults'}`}
      preferences={preferences}
      preferencesError={error}
    />
  );
}

function WorkoutSetupScreen({
  preferences,
  preferencesError,
}: {
  preferences: UserPreferences | null;
  preferencesError: string | null;
}) {
  const router = useRouter();
  const { session, signOut, user } = useAuth();
  const { recordGeneratedWorkout } = usePersistenceStore();
  const { request: previousRequest, saveGeneration, selectedSongs, setSelectedSongs } = useWorkoutStore();
  const setupDefaults = preferencesToSetupDefaults(preferences, previousRequest);
  const previousSong = previousRequest?.songs[0];
  const submissionInProgress = useRef(false);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(
    previousRequest?.muscle_group ?? 'chest'
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(
    setupDefaults.difficulty
  );
  const [equipment, setEquipment] = useState<Equipment[]>(setupDefaults.equipment);
  const [goal, setGoal] = useState<WorkoutGoal>(setupDefaults.goal);
  const [title, setTitle] = useState(previousSong?.title ?? 'Song 1');
  const [artist, setArtist] = useState(previousSong?.artist ?? 'Test Artist');
  const [minutes, setMinutes] = useState(() =>
    String(Math.floor((previousSong?.duration_ms ?? 225_000) / 60_000))
  );
  const [seconds, setSeconds] = useState(() =>
    String(Math.floor(((previousSong?.duration_ms ?? 225_000) % 60_000) / 1000))
  );
  const [errors, setErrors] = useState<WorkoutFormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignOut() {
    await spotifyMusicService.disconnect().catch(() => undefined);
    await signOut();
  }

  async function handleGenerateWorkout() {
    if (submissionInProgress.current) return;

    const formValues = { title, artist, minutes, seconds };
    const validationErrors = selectedSongs.length > 0 ? {} : validateWorkoutForm(formValues);
    setErrors(validationErrors);
    setApiError(null);

    if (Object.keys(validationErrors).length > 0) return;

    const request: GenerateWorkoutRequest = {
      muscle_group: muscleGroup,
      difficulty,
      equipment,
      goal,
      songs: selectedSongs.length > 0 ? selectedSongs : [
        {
          title: title.trim(),
          artist: artist.trim(),
          duration_ms: durationToMilliseconds(minutes, seconds),
        },
      ],
    };

    submissionInProgress.current = true;
    setIsLoading(true);
    try {
      if (!session?.access_token) throw new Error('Your session expired. Sign in again.');
      const generatedWorkout = await generatePersonalizedWorkout(request, session.access_token);
      saveGeneration(request, generatedWorkout);
      await recordGeneratedWorkout(request, generatedWorkout).catch(() => undefined);
      router.push('/workout-preview');
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'An unexpected error occurred.';
      setApiError(message);
    } finally {
      submissionInProgress.current = false;
      setIsLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <ThemedText type="subtitle" accessibilityRole="header">
                BeatFit
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Turn one song into a timed workout.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{user?.email}</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => void handleSignOut()} style={styles.signOutButton}>
                <ThemedText type="smallBold">Sign out</ThemedText>
              </Pressable>
            </View>

            <View style={styles.libraryLinks}>
              {process.env.EXPO_PUBLIC_APPLE_MUSIC_ENABLED === 'true' ? <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/apple-music')}
                style={({ pressed }) => [styles.libraryButton, { opacity: pressed ? 0.65 : 1 }]}>
                <ThemedText type="smallBold" style={styles.libraryButtonText}>Apple Music</ThemedText>
              </Pressable> : null}
              {process.env.EXPO_PUBLIC_SPOTIFY_ENABLED === 'true' ? <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/spotify')}
                style={({ pressed }) => [styles.libraryButton, { opacity: pressed ? 0.65 : 1 }]}>
                <ThemedText type="smallBold" style={styles.libraryButtonText}>Spotify</ThemedText>
              </Pressable> : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/saved-workouts')}
                style={({ pressed }) => [styles.libraryButton, { opacity: pressed ? 0.65 : 1 }]}>
                <ThemedText type="smallBold" style={styles.libraryButtonText}>
                  Saved Workouts
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/workout-history')}
                style={({ pressed }) => [styles.libraryButton, { opacity: pressed ? 0.65 : 1 }]}>
                <ThemedText type="smallBold" style={styles.libraryButtonText}>
                  History
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/preferences')}
                style={({ pressed }) => [styles.libraryButton, { opacity: pressed ? 0.65 : 1 }]}>
                <ThemedText type="smallBold" style={styles.libraryButtonText}>
                  Settings
                </ThemedText>
              </Pressable>
            </View>

            {preferencesError ? (
              <ThemedText accessibilityRole="alert" type="small" style={styles.errorText}>
                Preferences unavailable: {preferencesError} Defaults are shown instead.
              </ThemedText>
            ) : null}

            {selectedSongs.length > 0 ? (
              <ThemedView type="backgroundElement" style={styles.importedSongs}>
                <ThemedText type="smallBold">{selectedSongs.length} music track{selectedSongs.length === 1 ? '' : 's'} selected</ThemedText>
                <Pressable accessibilityRole="button" onPress={() => setSelectedSongs([])} style={styles.clearSongs}>
                  <ThemedText type="smallBold">Use manual song instead</ThemedText>
                </Pressable>
              </ThemedView>
            ) : null}

            <ThemedView type="backgroundElement" style={styles.panel}>
              <OptionGroup
                label="Muscle group"
                options={MUSCLE_GROUPS}
                selectedValue={muscleGroup}
                onSelect={setMuscleGroup}
              />
              <OptionGroup
                label="Difficulty"
                options={DIFFICULTIES}
                selectedValue={difficulty}
                onSelect={setDifficulty}
              />
              <MultiOptionGroup
                label="Equipment"
                options={EQUIPMENT}
                selectedValues={equipment}
                disabledValues={EQUIPMENT.filter(
                  (option) =>
                    preferences && !preferences.available_equipment.includes(option.value)
                ).map((option) => option.value)}
                onToggle={(value) => setEquipment((current) => toggleEquipment(current, value))}
              />
              <OptionGroup
                label="Workout goal"
                options={GOALS}
                selectedValue={goal}
                onSelect={setGoal}
              />

              <FormInput
                label="Song title"
                value={title}
                onChangeText={setTitle}
                placeholder="Song title"
                error={errors.title}
                autoCapitalize="words"
              />
              <FormInput
                label="Artist"
                value={artist}
                onChangeText={setArtist}
                placeholder="Artist"
                error={errors.artist}
                autoCapitalize="words"
              />

              <View style={styles.fieldGroup}>
                <InputLabel label="Duration" />
                <View style={styles.durationRow}>
                  <View style={styles.durationField}>
                    <FormInput
                      label="Minutes"
                      hideVisualLabel
                      value={minutes}
                      onChangeText={setMinutes}
                      placeholder="Minutes"
                      error={errors.minutes}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      maxLength={3}
                    />
                  </View>
                  <View style={styles.durationField}>
                    <FormInput
                      label="Seconds"
                      hideVisualLabel
                      value={seconds}
                      onChangeText={setSeconds}
                      placeholder="Seconds"
                      error={errors.seconds}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      maxLength={2}
                    />
                  </View>
                </View>
                {errors.duration && <InlineError message={errors.duration} />}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Generate workout"
                accessibilityState={{ disabled: isLoading, busy: isLoading }}
                disabled={isLoading}
                onPress={handleGenerateWorkout}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { opacity: pressed || isLoading ? 0.65 : 1 },
                ]}>
                {isLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#ffffff" />
                    <ThemedText style={styles.primaryButtonText}>Generating…</ThemedText>
                  </View>
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Generate Workout</ThemedText>
                )}
              </Pressable>

              {apiError && (
                <ThemedText accessibilityRole="alert" style={styles.errorText}>
                  {apiError}
                </ThemedText>
              )}
            </ThemedView>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function FormInput({
  label,
  error,
  hideVisualLabel = false,
  ...inputProps
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  error?: string;
  hideVisualLabel?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.fieldGroup}>
      {!hideVisualLabel && <InputLabel label={label} />}
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        accessibilityHint={error}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            borderColor: error ? '#dc2626' : theme.backgroundSelected,
            color: theme.text,
            backgroundColor: theme.background,
          },
          inputProps.style,
        ]}
      />
      {error && <InlineError message={error} />}
    </View>
  );
}

function InputLabel({ label }: { label: string }) {
  return <ThemedText type="smallBold">{label}</ThemedText>;
}

function InlineError({ message }: { message: string }) {
  return (
    <ThemedText accessibilityRole="alert" type="small" style={styles.errorText}>
      {message}
    </ThemedText>
  );
}

function OptionGroup<T extends string>({
  label,
  options,
  selectedValue,
  onSelect,
}: {
  label: string;
  options: readonly { label: string; value: T }[];
  selectedValue: T;
  onSelect: (value: T) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.fieldGroup} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <InputLabel label={label} />
      <View style={styles.optionGroup}>
        {options.map((option) => {
          const isSelected = option.value === selectedValue;

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: isSelected }}
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.optionButton,
                {
                  borderColor: isSelected ? '#2563eb' : theme.backgroundSelected,
                  backgroundColor: isSelected ? '#2563eb' : theme.background,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={isSelected ? styles.selectedOptionText : undefined}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MultiOptionGroup<T extends string>({
  label,
  options,
  selectedValues,
  disabledValues,
  onToggle,
}: {
  label: string;
  options: readonly { label: string; value: T }[];
  selectedValues: readonly T[];
  disabledValues: readonly T[];
  onToggle: (value: T) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.fieldGroup} accessibilityLabel={label}>
      <InputLabel label={label} />
      <View style={styles.optionGroup}>
        {options.map((option) => {
          const isSelected = selectedValues.includes(option.value);
          const isDisabled = disabledValues.includes(option.value);

          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: isSelected, disabled: isDisabled }}
              disabled={isDisabled}
              key={option.value}
              onPress={() => onToggle(option.value)}
              style={({ pressed }) => [
                styles.optionButton,
                {
                  borderColor: isSelected ? '#2563eb' : theme.backgroundSelected,
                  backgroundColor: isSelected ? '#2563eb' : theme.background,
                  opacity: pressed || isDisabled ? 0.5 : 1,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={isSelected ? styles.selectedOptionText : undefined}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  content: {
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  header: { gap: Spacing.one },
  signOutButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  libraryLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  libraryButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  libraryButtonText: { color: '#2563eb' },
  importedSongs: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two },
  clearSongs: { minHeight: 44, justifyContent: 'center' },
  panel: { gap: Spacing.three, padding: Spacing.three, borderRadius: Spacing.three },
  fieldGroup: { gap: Spacing.two },
  optionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  optionButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.two,
  },
  selectedOptionText: { color: '#ffffff' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    fontWeight: '500',
  },
  durationRow: { flexDirection: 'row', gap: Spacing.two },
  durationField: { flex: 1 },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#2563eb',
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  errorText: { color: '#dc2626' },
});

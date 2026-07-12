import { useRef, useState } from 'react';
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
import { generateWorkout } from '@/services/api';
import type {
  Difficulty,
  Equipment,
  GenerateWorkoutRequest,
  GenerateWorkoutResponse,
  MuscleGroup,
  WorkoutBlock,
} from '@/types/workout';
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

export default function HomeScreen() {
  const submissionInProgress = useRef(false);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest');
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [equipment, setEquipment] = useState<Equipment>('bodyweight');
  const [title, setTitle] = useState('Song 1');
  const [artist, setArtist] = useState('Test Artist');
  const [minutes, setMinutes] = useState('3');
  const [seconds, setSeconds] = useState('45');
  const [errors, setErrors] = useState<WorkoutFormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [workout, setWorkout] = useState<GenerateWorkoutResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleGenerateWorkout() {
    if (submissionInProgress.current) return;

    const formValues = { title, artist, minutes, seconds };
    const validationErrors = validateWorkoutForm(formValues);
    setErrors(validationErrors);
    setApiError(null);

    if (Object.keys(validationErrors).length > 0) return;

    const request: GenerateWorkoutRequest = {
      muscle_group: muscleGroup,
      difficulty,
      equipment: [equipment],
      songs: [
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
      setWorkout(await generateWorkout(request));
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
            </View>

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
              <OptionGroup
                label="Equipment"
                options={EQUIPMENT}
                selectedValue={equipment}
                onSelect={setEquipment}
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

            {workout && <WorkoutResult workout={workout} />}
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

function WorkoutResult({ workout }: { workout: GenerateWorkoutResponse }) {
  return (
    <View style={styles.results}>
      <ThemedText type="smallBold" accessibilityRole="header">
        Generated workout
      </ThemedText>
      {workout.blocks.map((block, index) => (
        <WorkoutBlockResult
          key={`${block.song.title}-${block.song.duration_ms}-${index}`}
          block={block}
        />
      ))}
    </View>
  );
}

function WorkoutBlockResult({ block }: { block: WorkoutBlock }) {
  return (
    <ThemedView type="backgroundElement" style={styles.panel}>
      <View style={styles.resultHeader}>
        <View style={styles.songDetails}>
          <ThemedText type="smallBold">{block.song.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {block.song.artist}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {formatTime(block.duration_seconds)}
        </ThemedText>
      </View>

      <View style={styles.intervalList}>
        {block.intervals.map((interval, index) => (
          <ThemedView
            key={`${interval.start_seconds}-${interval.end_seconds}-${index}`}
            style={styles.intervalRow}>
            <ThemedText type="code" style={styles.intervalTime}>
              {formatTime(interval.start_seconds)}–{formatTime(interval.end_seconds)}
            </ThemedText>
            <View style={styles.intervalDetails}>
              <ThemedText type="smallBold" style={styles.intervalType}>
                {interval.type}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {interval.exercise}
              </ThemedText>
            </View>
          </ThemedView>
        ))}
      </View>
    </ThemedView>
  );
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  results: { gap: Spacing.three },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  songDetails: { flex: 1, gap: Spacing.one },
  intervalList: { gap: Spacing.two },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  intervalTime: { width: 94 },
  intervalDetails: { flex: 1, gap: Spacing.one },
  intervalType: { textTransform: 'capitalize' },
});

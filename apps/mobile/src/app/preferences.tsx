import { useEffect, useMemo, useState } from 'react';
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
import { getExerciseCatalog } from '@/services/api';
import { usePreferences } from '@/state/preferences-store';
import type {
  Difficulty,
  Equipment,
  ExerciseSummary,
  UserPreferences,
  UserPreferencesUpdate,
  WorkoutGoal,
  WorkRestPreference,
} from '@/types/workout';
import {
  toPreferencesUpdate,
  toggleEquipment,
  toggleExclusiveExercise,
  WORK_REST_OPTIONS,
} from '@/utils/preferences';

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

export default function PreferencesScreen() {
  const { preferences, isLoading, error, reload } = usePreferences();

  if (isLoading && !preferences) {
    return <StatusState loading message="Loading workout preferences…" />;
  }
  if (!preferences) {
    return (
      <StatusState
        message={error ?? 'Workout preferences are unavailable.'}
        actionLabel="Try Again"
        onAction={() => void reload()}
      />
    );
  }

  return <PreferencesForm initialPreferences={preferences} />;
}

function PreferencesForm({ initialPreferences }: { initialPreferences: UserPreferences }) {
  const theme = useTheme();
  const { save, resetPersonalization } = usePreferences();
  const [draft, setDraft] = useState<UserPreferencesUpdate>(() =>
    toPreferencesUpdate(initialPreferences)
  );
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getExerciseCatalog()
      .then((catalog) => {
        if (active) setExercises(catalog);
      })
      .catch((caughtError) => {
        if (active) {
          setExerciseError(
            caughtError instanceof Error ? caughtError.message : 'Could not load exercises.'
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleExercises = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const matches = normalized
      ? exercises.filter(
          (exercise) =>
            exercise.name.toLocaleLowerCase().includes(normalized) ||
            exercise.id.toLocaleLowerCase().includes(normalized)
        )
      : exercises.filter(
          (exercise) =>
            draft.avoided_exercise_ids.includes(exercise.id) ||
            draft.favorite_exercise_ids.includes(exercise.id)
        );
    return matches.slice(0, 30);
  }, [draft.avoided_exercise_ids, draft.favorite_exercise_ids, exercises, query]);

  async function handleSave() {
    if (isSaving) return;
    setIsSaving(true);
    setMessage(null);
    try {
      await save(draft);
      setMessage('Preferences saved. New workouts will use these constraints.');
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : 'Could not save preferences.');
    } finally {
      setIsSaving(false);
    }
  }

  function confirmReset() {
    Alert.alert(
      'Reset personalization?',
      'BeatFit will ignore feedback submitted before now. Your saved preferences stay the same.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => void handleReset() },
      ]
    );
  }

  async function handleReset() {
    if (isResetting) return;
    setIsResetting(true);
    setMessage(null);
    try {
      await resetPersonalization();
      setMessage('Personalization history reset. Your preferences were preserved.');
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error ? caughtError.message : 'Could not reset personalization.'
      );
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.heading}>
            <ThemedText type="subtitle" accessibilityRole="header">
              Workout Preferences
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              These are hard constraints and conservative defaults. Feedback only makes small,
              explainable adjustments.
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ChoiceGroup
              label="Default difficulty"
              options={DIFFICULTIES}
              selected={draft.default_difficulty}
              onSelect={(default_difficulty) => setDraft({ ...draft, default_difficulty })}
            />
            <MultiChoiceGroup
              label="Available equipment"
              options={EQUIPMENT}
              selected={draft.available_equipment}
              onToggle={(value) =>
                setDraft({
                  ...draft,
                  available_equipment: toggleEquipment(draft.available_equipment, value),
                })
              }
            />
            <ChoiceGroup
              label="Preferred goal"
              options={GOALS}
              selected={draft.preferred_goal}
              onSelect={(preferred_goal) => setDraft({ ...draft, preferred_goal })}
            />
            <ChoiceGroup
              label="High-impact movements"
              options={[
                { label: 'Allowed', value: 'allowed' },
                { label: 'Disabled', value: 'disabled' },
              ] as const}
              selected={draft.high_impact_allowed ? 'allowed' : 'disabled'}
              onSelect={(value) =>
                setDraft({ ...draft, high_impact_allowed: value === 'allowed' })
              }
            />
            <ChoiceGroup<WorkRestPreference>
              label="Work and rest intensity"
              options={WORK_REST_OPTIONS}
              selected={draft.work_rest_preference}
              onSelect={(work_rest_preference) => setDraft({ ...draft, work_rest_preference })}
            />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Exercise preferences</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Search by exercise name. Avoided always wins over favorite if you change a choice.
            </ThemedText>
            <TextInput
              accessibilityLabel="Search exercises"
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercise names"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              style={[
                styles.searchInput,
                {
                  color: theme.text,
                  backgroundColor: theme.background,
                  borderColor: theme.backgroundSelected,
                },
              ]}
            />
            {exerciseError ? (
              <ThemedText accessibilityRole="alert" style={styles.errorText}>
                {exerciseError}
              </ThemedText>
            ) : null}
            {!query.trim() && visibleExercises.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Search to add favorite or avoided exercises.
              </ThemedText>
            ) : null}
            {query.trim() && visibleExercises.length === 0 && !exerciseError ? (
              <ThemedText type="small" themeColor="textSecondary">
                No matching exercises.
              </ThemedText>
            ) : null}
            {visibleExercises.map((exercise) => (
              <ExercisePreferenceRow
                exercise={exercise}
                avoided={draft.avoided_exercise_ids.includes(exercise.id)}
                favorite={draft.favorite_exercise_ids.includes(exercise.id)}
                key={exercise.id}
                onToggle={(target) =>
                  setDraft((current) => toggleExclusiveExercise(current, exercise.id, target))
                }
              />
            ))}
          </ThemedView>

          <View style={styles.actions}>
            <ActionButton
              label={isSaving ? 'Saving…' : 'Save Preferences'}
              onPress={() => void handleSave()}
              disabled={isSaving || isResetting}
              loading={isSaving}
              primary
            />
            <ActionButton
              label={isResetting ? 'Resetting…' : 'Reset Personalization'}
              onPress={confirmReset}
              disabled={isSaving || isResetting}
              loading={isResetting}
            />
            <ThemedText type="small" themeColor="textSecondary">
              Resetting only clears the feedback history used for future adjustments.
            </ThemedText>
          </View>

          {message ? (
            <ThemedText accessibilityRole="alert" themeColor="textSecondary">
              {message}
            </ThemedText>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ChoiceGroup<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly { label: string; value: T }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.choices}>
        {options.map((option) => {
          const checked = option.value === selected;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.choice,
                {
                  borderColor: checked ? '#2563eb' : theme.backgroundSelected,
                  backgroundColor: checked ? '#2563eb' : theme.background,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={checked ? styles.selectedText : undefined}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MultiChoiceGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly { label: string; value: T }[];
  selected: readonly T[];
  onToggle: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.choices}>
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              key={option.value}
              onPress={() => onToggle(option.value)}
              style={({ pressed }) => [
                styles.choice,
                {
                  borderColor: checked ? '#2563eb' : theme.backgroundSelected,
                  backgroundColor: checked ? '#2563eb' : theme.background,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={checked ? styles.selectedText : undefined}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ExercisePreferenceRow({
  exercise,
  avoided,
  favorite,
  onToggle,
}: {
  exercise: ExerciseSummary;
  avoided: boolean;
  favorite: boolean;
  onToggle: (target: 'avoid' | 'favorite') => void;
}) {
  return (
    <View style={styles.exerciseRow}>
      <View style={styles.exerciseDetails}>
        <ThemedText type="smallBold">{exercise.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {exercise.primary_muscle_group.replace('_', ' ')} · {exercise.equipment.join(', ')}
          {exercise.high_impact ? ' · high impact' : ''}
        </ThemedText>
      </View>
      <View style={styles.exerciseActions}>
        <SmallToggle label="Avoid" checked={avoided} onPress={() => onToggle('avoid')} />
        <SmallToggle label="Favorite" checked={favorite} onPress={() => onToggle('favorite')} />
      </View>
    </View>
  );
}

function SmallToggle({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={[styles.smallToggle, checked && styles.smallToggleSelected]}>
      <ThemedText type="smallBold" style={checked ? styles.selectedText : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ActionButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary ? styles.primaryAction : styles.secondaryAction,
        { opacity: pressed || disabled ? 0.65 : 1 },
      ]}>
      {loading ? <ActivityIndicator color={primary ? '#ffffff' : '#2563eb'} /> : null}
      <ThemedText type="smallBold" style={primary ? styles.selectedText : styles.secondaryText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function StatusState({
  message,
  loading = false,
  actionLabel,
  onAction,
}: {
  message: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <ThemedView style={styles.statusState}>
      {loading ? <ActivityIndicator size="large" /> : null}
      <ThemedText accessibilityRole={loading ? undefined : 'alert'}>{message}</ThemedText>
      {actionLabel && onAction ? (
        <ActionButton label={actionLabel} onPress={onAction} primary />
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  heading: { gap: Spacing.one },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.four },
  group: { gap: Spacing.two },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.two,
  },
  selectedText: { color: '#ffffff' },
  searchInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  exerciseRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#94a3b8',
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  exerciseDetails: { gap: Spacing.one },
  exerciseActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  smallToggle: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  smallToggleSelected: { backgroundColor: '#2563eb' },
  actions: { gap: Spacing.two },
  action: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  primaryAction: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  secondaryAction: { backgroundColor: 'transparent', borderColor: '#2563eb' },
  secondaryText: { color: '#2563eb' },
  errorText: { color: '#dc2626' },
  statusState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
});

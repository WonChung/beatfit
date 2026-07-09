import { useState } from 'react';
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

const API_BASE_URL = 'http://127.0.0.1:8000';

const MUSCLE_GROUPS = [
  { label: 'Chest', value: 'chest' },
  { label: 'Back', value: 'back' },
  { label: 'Legs', value: 'legs' },
  { label: 'Shoulders', value: 'shoulders' },
  { label: 'Arms', value: 'arms' },
  { label: 'Core', value: 'core' },
  { label: 'Full body', value: 'full_body' },
] as const;

const DIFFICULTIES = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Advanced', value: 'advanced' },
] as const;

type MuscleGroup = (typeof MUSCLE_GROUPS)[number]['value'];
type Difficulty = (typeof DIFFICULTIES)[number]['value'];

type WorkoutInterval = {
  start_seconds: number;
  end_seconds: number;
  type: string;
  exercise: string;
};

type WorkoutBlock = {
  song: {
    title: string;
    artist: string;
    duration_ms: number;
  };
  duration_seconds: number;
  intervals: WorkoutInterval[];
};

type GeneratedWorkout = {
  muscle_group: MuscleGroup;
  difficulty: Difficulty;
  equipment: string[];
  blocks: WorkoutBlock[];
};

export default function HomeScreen() {
  const theme = useTheme();
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest');
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [title, setTitle] = useState('Song 1');
  const [artist, setArtist] = useState('Test Artist');
  const [minutes, setMinutes] = useState('3');
  const [seconds, setSeconds] = useState('45');
  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleGenerateWorkout() {
    setError(null);
    setWorkout(null);

    const durationMs = getDurationMs(minutes, seconds);
    if (!title.trim() || !artist.trim()) {
      setError('Enter a song title and artist.');
      return;
    }
    if (!durationMs) {
      setError('Enter a song duration greater than 0 seconds.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/workouts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          muscle_group: muscleGroup,
          difficulty,
          equipment: ['bodyweight'],
          songs: [
            {
              title: title.trim(),
              artist: artist.trim(),
              duration_ms: durationMs,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const data = (await response.json()) as GeneratedWorkout;
      setWorkout(data);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unknown error';
      setError(`Could not generate workout. ${message}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <ThemedText type="subtitle">BeatFit</ThemedText>
              <ThemedText themeColor="textSecondary">
                Generate a timed workout from one song.
              </ThemedText>
            </View>

            <ThemedView type="backgroundElement" style={styles.panel}>
              <InputLabel label="Muscle group" />
              <OptionGroup
                options={MUSCLE_GROUPS}
                selectedValue={muscleGroup}
                onSelect={setMuscleGroup}
              />

              <InputLabel label="Difficulty" />
              <OptionGroup
                options={DIFFICULTIES}
                selectedValue={difficulty}
                onSelect={setDifficulty}
              />

              <InputLabel label="Song title" />
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Song title"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  {
                    borderColor: theme.backgroundSelected,
                    color: theme.text,
                    backgroundColor: theme.background,
                  },
                ]}
              />

              <InputLabel label="Artist" />
              <TextInput
                value={artist}
                onChangeText={setArtist}
                placeholder="Artist"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  {
                    borderColor: theme.backgroundSelected,
                    color: theme.text,
                    backgroundColor: theme.background,
                  },
                ]}
              />

              <InputLabel label="Duration" />
              <View style={styles.durationRow}>
                <TextInput
                  value={minutes}
                  onChangeText={setMinutes}
                  keyboardType="number-pad"
                  placeholder="Min"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    styles.durationInput,
                    {
                      borderColor: theme.backgroundSelected,
                      color: theme.text,
                      backgroundColor: theme.background,
                    },
                  ]}
                />
                <TextInput
                  value={seconds}
                  onChangeText={setSeconds}
                  keyboardType="number-pad"
                  placeholder="Sec"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    styles.durationInput,
                    {
                      borderColor: theme.backgroundSelected,
                      color: theme.text,
                      backgroundColor: theme.background,
                    },
                  ]}
                />
              </View>

              <Pressable
                disabled={isLoading}
                onPress={handleGenerateWorkout}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { opacity: pressed || isLoading ? 0.72 : 1 },
                ]}>
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Generate Workout</ThemedText>
                )}
              </Pressable>

              {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}
            </ThemedView>

            {workout && <WorkoutResult workout={workout} />}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function InputLabel({ label }: { label: string }) {
  return (
    <ThemedText type="smallBold" style={styles.label}>
      {label}
    </ThemedText>
  );
}

function OptionGroup<T extends string>({
  options,
  selectedValue,
  onSelect,
}: {
  options: readonly { label: string; value: T }[];
  selectedValue: T;
  onSelect: (value: T) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.optionGroup}>
      {options.map((option) => {
        const isSelected = option.value === selectedValue;

        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={[
              styles.optionButton,
              {
                borderColor: isSelected ? '#2563eb' : theme.backgroundSelected,
                backgroundColor: isSelected ? '#2563eb' : theme.background,
              },
            ]}>
            <ThemedText
              type="smallBold"
              style={isSelected ? styles.selectedOptionText : undefined}
              themeColor={isSelected ? undefined : 'text'}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function WorkoutResult({ workout }: { workout: GeneratedWorkout }) {
  const block = workout.blocks[0];

  return (
    <ThemedView type="backgroundElement" style={styles.panel}>
      <View style={styles.resultHeader}>
        <ThemedText type="smallBold">{block.song.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDuration(block.duration_seconds)}
        </ThemedText>
      </View>

      <View style={styles.intervalList}>
        {block.intervals.map((interval) => (
          <ThemedView
            key={`${interval.start_seconds}-${interval.end_seconds}-${interval.exercise}`}
            style={styles.intervalRow}>
            <View style={styles.intervalTime}>
              <ThemedText type="code">{formatTime(interval.start_seconds)}</ThemedText>
              <ThemedText type="code" themeColor="textSecondary">
                {formatTime(interval.end_seconds)}
              </ThemedText>
            </View>
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

function getDurationMs(minutes: string, seconds: string) {
  const parsedMinutes = Number.parseInt(minutes || '0', 10);
  const parsedSeconds = Number.parseInt(seconds || '0', 10);
  const totalSeconds =
    (Number.isNaN(parsedMinutes) ? 0 : parsedMinutes * 60) +
    (Number.isNaN(parsedSeconds) ? 0 : parsedSeconds);

  return totalSeconds > 0 ? totalSeconds * 1000 : 0;
}

function formatDuration(durationSeconds: number) {
  return `${formatTime(durationSeconds)} total`;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
  panel: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  label: {
    marginBottom: -Spacing.two,
  },
  optionGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  optionButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.two,
  },
  selectedOptionText: {
    color: '#ffffff',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    fontWeight: '500',
  },
  durationRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  durationInput: {
    flex: 1,
  },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#2563eb',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  errorText: {
    color: '#dc2626',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    alignItems: 'center',
  },
  intervalList: {
    gap: Spacing.two,
  },
  intervalRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  intervalTime: {
    width: 52,
    gap: Spacing.one,
  },
  intervalDetails: {
    flex: 1,
    gap: Spacing.one,
  },
  intervalType: {
    textTransform: 'capitalize',
  },
});

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useWorkoutStore } from '@/state/workout-store';
import { formatTotalWorkoutDuration } from '@/utils/workout-format';

export default function WorkoutPlayerScreen() {
  const router = useRouter();
  const { workout } = useWorkoutStore();

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
        <View style={styles.copy}>
          <ThemedText type="subtitle" accessibilityRole="header">
            {workout ? 'Workout Ready' : 'No Workout Loaded'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            {workout
              ? `${formatTotalWorkoutDuration(workout)} planned. The active workout timer will be added in a future step.`
              : 'Return to setup and generate a workout first.'}
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => (workout ? router.back() : router.dismissTo('/'))}
          style={({ pressed }) => [styles.button, { opacity: pressed ? 0.65 : 1 }]}>
          <ThemedText type="smallBold" style={styles.buttonText}>
            {workout ? 'Back to Preview' : 'Go to Setup'}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  copy: { alignItems: 'center', gap: Spacing.two },
  centeredText: { textAlign: 'center' },
  button: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#2563eb',
  },
  buttonText: { color: '#ffffff' },
});

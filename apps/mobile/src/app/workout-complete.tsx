import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function WorkoutCompleteScreen() {
  const router = useRouter();
  const { status } = useLocalSearchParams<{ status?: string }>();
  const endedEarly = status === 'ended-early';

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
        <ThemedText type="subtitle" accessibilityRole="header" style={styles.centeredText}>
          {endedEarly ? 'Workout Ended' : 'Workout Complete'}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {endedEarly
            ? 'The workout was ended early. Your generated plan is still available.'
            : 'You completed every interval. Great work!'}
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.dismissTo('/workout-preview')}
          style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.65 : 1 }]}>
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            Back to Preview
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.dismissTo('/')}
          style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.65 : 1 }]}>
          <ThemedText type="smallBold" style={styles.secondaryButtonText}>
            Edit Setup
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
    gap: Spacing.three,
  },
  centeredText: { textAlign: 'center' },
  primaryButton: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#2563eb',
  },
  primaryButtonText: { color: '#ffffff' },
  secondaryButton: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  secondaryButtonText: { color: '#2563eb' },
});

import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import {
  type ExerciseVisualAssetKey,
  resolveExerciseVisual,
} from '@/utils/exercise-visual';

const EXERCISE_VISUAL_SOURCES: Record<ExerciseVisualAssetKey, number> = {
  'push-up': require('@/assets/exercises/push-up.svg'),
  prone: require('@/assets/exercises/prone.svg'),
  row: require('@/assets/exercises/row.svg'),
  squat: require('@/assets/exercises/squat.svg'),
  'wall-sit': require('@/assets/exercises/wall-sit.svg'),
  standing: require('@/assets/exercises/standing.svg'),
  dip: require('@/assets/exercises/dip.svg'),
  'core-floor': require('@/assets/exercises/core-floor.svg'),
  plank: require('@/assets/exercises/plank.svg'),
  fallback: require('@/assets/exercises/fallback.svg'),
};

export interface ExerciseVisualProps {
  exerciseName: string;
  size?: number;
  showLabel?: boolean;
  fallbackBehavior?: 'placeholder' | 'hide';
}

export function ExerciseVisual({
  exerciseName,
  size = 160,
  showLabel,
  fallbackBehavior = 'placeholder',
}: ExerciseVisualProps) {
  const theme = useTheme();
  const resolution = resolveExerciseVisual(exerciseName);
  const displayName = exerciseName.trim() || 'Unknown exercise';
  const visualSize = Math.max(40, size);
  const shouldShowLabel = showLabel ?? resolution.isFallback;

  if (resolution.isFallback && fallbackBehavior === 'hide') return null;

  return (
    <View style={[styles.container, { width: visualSize }]}>
      <View
        style={[
          styles.frame,
          {
            width: visualSize,
            height: visualSize,
            padding: Math.max(4, Math.round(visualSize * 0.08)),
            backgroundColor: theme.backgroundSelected,
          },
        ]}>
        <Image
          accessible
          accessibilityRole="image"
          accessibilityLabel={
            resolution.isFallback
              ? `Placeholder exercise visual for ${displayName}`
              : `Exercise visual for ${displayName}`
          }
          source={EXERCISE_VISUAL_SOURCES[resolution.assetKey]}
          contentFit="contain"
          contentPosition="center"
          style={styles.image}
        />
      </View>
      {shouldShowLabel ? (
        <ThemedText numberOfLines={2} type="small" style={styles.label}>
          {displayName}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  image: { width: '100%', height: '100%' },
  label: { width: '100%', textAlign: 'center' },
});

import { Image } from 'expo-image';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { ExerciseVisual } from '@/components/exercise-visual';
import { useTheme } from '@/hooks/use-theme';
import {
  type ExerciseAnimationPoseKey,
  getExerciseAnimationPlaybackState,
  resolveExerciseAnimation,
} from '@/utils/exercise-animation';

const EXERCISE_ANIMATION_POSES: Record<ExerciseAnimationPoseKey, number> = {
  'push-up-start': require('@/assets/exercise-animations/push-up-start.svg'),
  'push-up-end': require('@/assets/exercise-animations/push-up-end.svg'),
  'squat-start': require('@/assets/exercise-animations/squat-start.svg'),
  'squat-end': require('@/assets/exercise-animations/squat-end.svg'),
  'mountain-climber-start': require('@/assets/exercise-animations/mountain-climber-start.svg'),
  'mountain-climber-end': require('@/assets/exercise-animations/mountain-climber-end.svg'),
  'rest-start': require('@/assets/exercise-animations/rest-start.svg'),
  'rest-end': require('@/assets/exercise-animations/rest-end.svg'),
  'generic-start': require('@/assets/exercise-animations/generic-start.svg'),
  'generic-end': require('@/assets/exercise-animations/generic-end.svg'),
};

export interface ExerciseAnimationProps {
  exerciseId?: string | null;
  exerciseName: string;
  size: number;
  isPaused: boolean;
  accessibilityLabel?: string;
  intervalType?: string;
}

function useReducedMotionEnabled(): boolean {
  // Default to no motion until the platform preference has been read.
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(true);

  useEffect(() => {
    let isMounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) setReduceMotionEnabled(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled
    );
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotionEnabled;
}

function ExerciseAnimationComponent({
  exerciseId,
  exerciseName,
  size,
  isPaused,
  accessibilityLabel,
  intervalType,
}: ExerciseAnimationProps) {
  const theme = useTheme();
  const reduceMotionEnabled = useReducedMotionEnabled();
  const [progress] = useState(() => new Animated.Value(0));
  const previousRenderKey = useRef<string | null>(null);
  const animation = useMemo(
    () => resolveExerciseAnimation({ exerciseId, exerciseName, intervalType }),
    [exerciseId, exerciseName, intervalType]
  );
  const playbackState = getExerciseAnimationPlaybackState({
    animation,
    isPaused,
    reduceMotionEnabled,
  });
  const visualSize = Math.max(40, size);
  const isRest = animation.source === 'rest';
  const label =
    accessibilityLabel ??
    (isRest
      ? 'Rest interval breathing demonstration'
      : `${exerciseName.trim() || 'Unknown exercise'} exercise demonstration`);

  useEffect(() => {
    if (previousRenderKey.current !== animation.renderKey) {
      progress.stopAnimation();
      progress.setValue(0);
      previousRenderKey.current = animation.renderKey;
    }
  }, [animation.renderKey, progress]);

  useEffect(() => {
    if (playbackState !== 'animating') {
      progress.stopAnimation();
      if (playbackState === 'reduced-motion') progress.setValue(0);
      return;
    }

    const halfCycleDuration = Math.max(180, Math.round(900 / animation.playbackSpeed));
    const cycle = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: halfCycleDuration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        toValue: 0,
        duration: halfCycleDuration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
    const runningAnimation = animation.loop
      ? Animated.loop(cycle, { resetBeforeIteration: false })
      : cycle;
    runningAnimation.start();
    return () => runningAnimation.stop();
  }, [animation.loop, animation.playbackSpeed, animation.renderKey, playbackState, progress]);

  const frameStyle = [
    styles.frame,
    {
      width: visualSize,
      height: visualSize,
      padding: Math.max(4, Math.round(visualSize * 0.05)),
      backgroundColor: theme.backgroundSelected,
    },
  ];
  const accessibilityHint =
    playbackState === 'reduced-motion'
      ? 'A static pose is shown because reduced motion is enabled.'
      : playbackState === 'paused'
        ? 'The demonstration is paused.'
        : undefined;

  if (animation.animationKey === 'static' && !animation.startPoseKey) {
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        style={{ width: visualSize }}>
        <View importantForAccessibility="no-hide-descendants">
          <ExerciseVisual exerciseName={exerciseName} size={visualSize} showLabel={false} />
        </View>
      </View>
    );
  }

  const startPoseKey = animation.startPoseKey ?? animation.endPoseKey;
  const endPoseKey = animation.endPoseKey ?? startPoseKey;
  if (!startPoseKey || !endPoseKey) {
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        style={{ width: visualSize }}>
        <View importantForAccessibility="no-hide-descendants">
          <ExerciseVisual exerciseName={exerciseName} size={visualSize} showLabel={false} />
        </View>
      </View>
    );
  }

  const startOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={[styles.container, { width: visualSize }]}
      testID="exercise-animation">
      <View style={frameStyle}>
        <Animated.View style={[styles.pose, { opacity: startOpacity }]}>
          <Image
            source={EXERCISE_ANIMATION_POSES[startPoseKey]}
            contentFit="contain"
            contentPosition="center"
            style={styles.image}
          />
        </Animated.View>
        {startPoseKey !== endPoseKey ? (
          <Animated.View style={[styles.pose, { opacity: progress }]}>
            <Image
              source={EXERCISE_ANIMATION_POSES[endPoseKey]}
              contentFit="contain"
              contentPosition="center"
              style={styles.image}
            />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

export const ExerciseAnimation = memo(ExerciseAnimationComponent);

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  pose: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
});

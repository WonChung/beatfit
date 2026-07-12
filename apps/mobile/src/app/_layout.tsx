import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PersistenceProvider } from '@/state/persistence-store';
import { WorkoutProvider } from '@/state/workout-store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PersistenceProvider>
        <WorkoutProvider>
          <AnimatedSplashOverlay />
          <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="workout-preview" options={{ title: 'Workout Preview' }} />
          <Stack.Screen name="workout-player" options={{ title: 'Workout' }} />
          <Stack.Screen name="saved-workouts" options={{ title: 'Saved Workouts' }} />
          <Stack.Screen name="workout-history" options={{ title: 'Workout History' }} />
          <Stack.Screen
            name="workout-complete"
            options={{ title: 'Workout Complete', gestureEnabled: false }}
          />
          </Stack>
        </WorkoutProvider>
      </PersistenceProvider>
    </ThemeProvider>
  );
}

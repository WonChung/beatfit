import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PersistenceProvider } from '@/state/persistence-store';
import { WorkoutProvider } from '@/state/workout-store';
import { AuthProvider, useAuth } from '@/state/auth-store';
import { PreferencesProvider } from '@/state/preferences-store';

export { AppErrorBoundary as ErrorBoundary } from '@/components/app-error-boundary';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <AccountBoundary />
      </AuthProvider>
    </ThemeProvider>
  );
}

function AccountBoundary() {
  const { session, isRestoring } = useAuth();
  if (isRestoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" accessibilityLabel="Restoring session" />
      </View>
    );
  }

  if (!session) return <AuthenticatedStack />;

  const userId = session.user.id;
  return (
    <PersistenceProvider key={userId} userId={userId}>
      <PreferencesProvider>
        <WorkoutProvider>
          <AuthenticatedStack />
        </WorkoutProvider>
      </PreferencesProvider>
    </PersistenceProvider>
  );
}

function AuthenticatedStack() {
  const { session } = useAuth();
  return (
    <Stack>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="workout-preview" options={{ title: 'Workout Preview' }} />
        <Stack.Screen name="workout-player" options={{ title: 'Workout' }} />
        <Stack.Screen name="saved-workouts" options={{ title: 'Saved Workouts' }} />
        <Stack.Screen name="workout-history" options={{ title: 'Workout History' }} />
        <Stack.Screen name="preferences" options={{ title: 'Workout Preferences' }} />
        <Stack.Screen name="apple-music" options={{ title: 'Apple Music' }} />
        <Stack.Screen name="spotify" options={{ title: 'Spotify' }} />
        <Stack.Screen
          name="workout-complete"
          options={{ title: 'Workout Complete', gestureEnabled: false }}
        />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

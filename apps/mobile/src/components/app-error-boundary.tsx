import type { ErrorBoundaryProps } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Last-resort fallback for an uncaught route render error.
 *
 * Error details are deliberately not rendered or logged here: an exception can
 * contain credentials, provider tokens, or other private runtime state. A
 * production error reporter can be added later with explicit redaction.
 */
export function AppErrorBoundary({ retry }: ErrorBoundaryProps) {
  const handleRetry = () => {
    void retry().catch(() => {
      // Keep the safe fallback mounted when recovery also fails.
    });
  };

  return (
    <View style={styles.screen} accessibilityRole="alert">
      <View style={styles.card}>
        <Text style={styles.eyebrow}>BeatFit</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          We could not load this screen. Your sign-in details and provider data have not been
          displayed.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try loading the screen again"
          onPress={handleRetry}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#101218',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    padding: 28,
    borderRadius: 24,
    backgroundColor: '#ffffff',
  },
  eyebrow: {
    marginBottom: 12,
    color: '#3558f4',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    color: '#101218',
    fontSize: 30,
    fontWeight: '900',
  },
  message: {
    marginTop: 12,
    color: '#636978',
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    minHeight: 52,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: '#3558f4',
  },
  buttonPressed: {
    backgroundColor: '#243fc4',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});

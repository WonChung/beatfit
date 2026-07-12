import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-store';

export default function SignInScreen() {
  const { signIn, signUp } = useAuth();
  const theme = useTheme();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (loading) return;
    setError(null);
    setMessage(null);
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'sign-in') await signIn(email, password);
      else if (await signUp(email, password)) setMessage('Check your email to confirm your account.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
          <View style={styles.card}>
            <ThemedText type="title">BeatFit</ThemedText>
            <ThemedText themeColor="textSecondary">
              {mode === 'sign-in' ? 'Sign in to continue your workouts.' : 'Create your BeatFit account.'}
            </ThemedText>
            <ThemedText type="smallBold">Email</ThemedText>
            <TextInput accessibilityLabel="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]} />
            <ThemedText type="smallBold">Password</ThemedText>
            <TextInput accessibilityLabel="Password" autoCapitalize="none" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]} />
            {error ? <ThemedText style={styles.error} accessibilityRole="alert">{error}</ThemedText> : null}
            {message ? <ThemedText style={styles.message} accessibilityRole="alert">{message}</ThemedText> : null}
            <Pressable accessibilityRole="button" disabled={loading} onPress={submit} style={styles.primary}>
              {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.primaryText}>{mode === 'sign-in' ? 'Sign In' : 'Sign Up'}</ThemedText>}
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(null); setMessage(null); }} style={styles.switchButton}>
              <ThemedText type="smallBold">{mode === 'sign-in' ? 'Create an account' : 'Already have an account? Sign in'}</ThemedText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safeArea: { flex: 1 }, center: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { gap: 14, width: '100%', maxWidth: 460, alignSelf: 'center' },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  primary: { minHeight: 52, borderRadius: 26, backgroundColor: '#3558f4', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryText: { color: '#fff', fontWeight: '800' }, switchButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#c62828' }, message: { color: '#218739' },
});

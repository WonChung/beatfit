import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import { createMigratingAuthStorage } from '@/services/auth-storage';
import { validateSupabasePublicConfig } from '@/services/supabase-config';

const supabaseConfig = validateSupabasePublicConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export const isSupabaseConfigured = supabaseConfig.isConfigured;

const nativeAuthStorage =
  Platform.OS === 'web'
    ? undefined
    : createMigratingAuthStorage({
        secureStorage: {
          getItem: (key) => SecureStore.getItemAsync(key),
          setItem: (key, value) =>
            SecureStore.setItemAsync(key, value, {
              keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
            }),
          removeItem: (key) => SecureStore.deleteItemAsync(key),
        },
        legacyStorage: AsyncStorage,
      });

export const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.publishableKey,
  {
    auth: {
      ...(nativeAuthStorage ? { storage: nativeAuthStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  }
);

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { API_BASE_URL } from '@/services/api';
import { supabase } from '@/services/supabase';
import type {
  AppleMusicAuthorizationStatus,
  AppleMusicPage,
  AppleMusicPlaylist,
  AppleMusicService,
  AppleMusicTrack,
} from './types';
import { AppleMusicError } from './types';

interface NativeAppleMusicModule {
  authorizationStatus(): Promise<AppleMusicAuthorizationStatus>;
  authorize(developerToken?: string): Promise<AppleMusicAuthorizationStatus>;
  disconnect(): Promise<void>;
  listPlaylists(page?: string): Promise<AppleMusicPage<AppleMusicPlaylist>>;
  getPlaylistTracks(id: string, page?: string): Promise<AppleMusicPage<AppleMusicTrack>>;
}

const nativeModule = requireOptionalNativeModule<NativeAppleMusicModule>('BeatFitAppleMusic');

export class NativeAppleMusicService implements AppleMusicService {
  capabilities() {
    return {
      personalizedLibrary: Boolean(nativeModule),
      catalogMetadata: true,
      reason: nativeModule ? undefined : 'Apple Music requires a BeatFit development build.',
    };
  }

  async authorizationStatus() {
    return nativeModule ? nativeModule.authorizationStatus() : 'unavailable' as const;
  }

  async authorize() {
    if (!nativeModule) throw unavailable();
    const developerToken = Platform.OS === 'android' ? await getDeveloperToken() : undefined;
    return nativeModule.authorize(developerToken);
  }

  async disconnect() {
    if (!nativeModule) throw unavailable();
    await nativeModule.disconnect();
  }

  async listPlaylists(page?: string) {
    if (!nativeModule) throw unavailable();
    return nativeModule.listPlaylists(page);
  }

  async getPlaylistTracks(id: string, page?: string) {
    if (!nativeModule) throw unavailable();
    return nativeModule.getPlaylistTracks(id, page);
  }
}

async function getDeveloperToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new AppleMusicError('Sign in to BeatFit first.', 'expired');
  try {
    const response = await fetch(`${API_BASE_URL}/music/apple/developer-token`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    if (!response.ok) throw new Error();
    return ((await response.json()) as { token: string }).token;
  } catch {
    throw new AppleMusicError('Could not connect to Apple Music.', 'network');
  }
}

function unavailable() {
  return new AppleMusicError('Apple Music requires a BeatFit development build.', 'unavailable');
}

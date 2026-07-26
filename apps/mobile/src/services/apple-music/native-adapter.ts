import * as SecureStore from 'expo-secure-store';
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

export interface NativeAppleMusicModule {
  authorizationStatus(): Promise<AppleMusicAuthorizationStatus>;
  authorize(developerToken?: string): Promise<AppleMusicAuthorizationStatus>;
  disconnect(): Promise<void>;
  listPlaylists(page?: string): Promise<AppleMusicPage<AppleMusicPlaylist>>;
  getPlaylistTracks(id: string, page?: string): Promise<AppleMusicPage<AppleMusicTrack>>;
}

interface BeatFitSession {
  userId: string;
  accessToken: string;
}

interface AppleMusicOwnerStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(
    key: string,
    value: string,
    options?: SecureStore.SecureStoreOptions
  ): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface NativeAppleMusicDependencies {
  nativeModule: NativeAppleMusicModule | null;
  ownerStorage: AppleMusicOwnerStorage;
  getSession(): Promise<BeatFitSession | null>;
  platform: typeof Platform.OS;
  fetcher: typeof fetch;
}

const OWNER_KEY = 'beatfit.appleMusic.owner.v1';
const defaultNativeModule =
  requireOptionalNativeModule<NativeAppleMusicModule>('BeatFitAppleMusic');

export class NativeAppleMusicService implements AppleMusicService {
  private readonly dependencies: NativeAppleMusicDependencies;

  constructor(dependencies: Partial<NativeAppleMusicDependencies> = {}) {
    this.dependencies = {
      nativeModule: defaultNativeModule,
      ownerStorage: SecureStore,
      getSession: currentBeatFitSession,
      platform: Platform.OS,
      fetcher: fetch,
      ...dependencies,
    };
  }

  capabilities() {
    const { nativeModule } = this.dependencies;
    return {
      personalizedLibrary: Boolean(nativeModule),
      catalogMetadata: true,
      reason: nativeModule ? undefined : 'Apple Music requires a BeatFit development build.',
    };
  }

  async authorizationStatus() {
    const { nativeModule } = this.dependencies;
    if (!nativeModule) return 'unavailable' as const;

    const session = await this.dependencies.getSession();
    if (!session) {
      await this.clearConnectionBestEffort();
      return 'expired' as const;
    }

    if ((await this.readOwner()) !== session.userId) {
      await this.clearConnectionBestEffort();
      return 'not_determined' as const;
    }

    const status = await nativeModule.authorizationStatus();
    if (!(await this.connectionIsOwnedBy(session.userId))) {
      await this.clearConnectionBestEffort();
      return 'not_determined' as const;
    }
    if (status !== 'authorized') await this.clearConnectionBestEffort();
    return status;
  }

  async authorize() {
    const { nativeModule } = this.dependencies;
    if (!nativeModule) throw unavailable();

    const session = await this.requireSession();
    const existingOwner = await this.readOwner();
    if (existingOwner && existingOwner !== session.userId) {
      await this.clearConnectionBestEffort();
    }

    const developerToken =
      this.dependencies.platform === 'android'
        ? await getDeveloperToken(session.accessToken, this.dependencies.fetcher)
        : undefined;
    const status = await nativeModule.authorize(developerToken);
    if (status !== 'authorized') {
      await this.clearConnectionBestEffort();
      return status;
    }

    if (!(await this.sessionStillBelongsTo(session.userId))) {
      await this.clearConnectionBestEffort();
      throw accountChanged();
    }

    try {
      await this.dependencies.ownerStorage.setItemAsync(
        OWNER_KEY,
        JSON.stringify({ beatFitUserId: session.userId }),
        { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
      );
    } catch {
      await this.clearConnectionBestEffort();
      throw new AppleMusicError(
        'Could not protect the Apple Music connection on this device.',
        'unavailable'
      );
    }

    if (!(await this.connectionIsOwnedBy(session.userId))) {
      await this.clearConnectionBestEffort();
      throw accountChanged();
    }
    return status;
  }

  async disconnect() {
    const { nativeModule } = this.dependencies;
    let ownerError: unknown;
    try {
      await this.dependencies.ownerStorage.deleteItemAsync(OWNER_KEY);
    } catch (error) {
      ownerError = error;
    }

    let nativeError: unknown;
    try {
      if (!nativeModule) throw unavailable();
      await nativeModule.disconnect();
    } catch (error) {
      nativeError = error;
    }

    if (ownerError) {
      throw new AppleMusicError(
        'Could not clear the Apple Music connection on this device.',
        'unavailable'
      );
    }
    if (nativeError) throw nativeError;
  }

  async listPlaylists(page?: string) {
    const { nativeModule } = this.dependencies;
    if (!nativeModule) throw unavailable();
    const ownerId = await this.requireOwnedConnection();
    const result = await nativeModule.listPlaylists(page);
    await this.assertConnectionStillOwnedBy(ownerId);
    return result;
  }

  async getPlaylistTracks(id: string, page?: string) {
    const { nativeModule } = this.dependencies;
    if (!nativeModule) throw unavailable();
    const ownerId = await this.requireOwnedConnection();
    const result = await nativeModule.getPlaylistTracks(id, page);
    await this.assertConnectionStillOwnedBy(ownerId);
    return result;
  }

  private async requireSession(): Promise<BeatFitSession> {
    const session = await this.dependencies.getSession();
    if (!session) throw new AppleMusicError('Sign in to BeatFit first.', 'expired');
    return session;
  }

  private async requireOwnedConnection(): Promise<string> {
    const session = await this.requireSession();
    if ((await this.readOwner()) !== session.userId) {
      await this.clearConnectionBestEffort();
      throw new AppleMusicError('Connect Apple Music to continue.', 'expired');
    }
    return session.userId;
  }

  private async assertConnectionStillOwnedBy(userId: string): Promise<void> {
    if (await this.connectionIsOwnedBy(userId)) return;
    await this.clearConnectionBestEffort();
    throw accountChanged();
  }

  private async connectionIsOwnedBy(userId: string): Promise<boolean> {
    return (await this.sessionStillBelongsTo(userId)) && (await this.readOwner()) === userId;
  }

  private async sessionStillBelongsTo(userId: string): Promise<boolean> {
    return (await this.dependencies.getSession())?.userId === userId;
  }

  private async readOwner(): Promise<string | null> {
    let stored: string | null;
    try {
      stored = await this.dependencies.ownerStorage.getItemAsync(OWNER_KEY);
    } catch {
      throw new AppleMusicError(
        'Could not verify the Apple Music connection on this device.',
        'unavailable'
      );
    }
    if (!stored) return null;

    try {
      const parsed = JSON.parse(stored) as { beatFitUserId?: unknown };
      if (typeof parsed.beatFitUserId === 'string' && parsed.beatFitUserId) {
        return parsed.beatFitUserId;
      }
    } catch {
      // Invalid owner metadata is cleared below and never grants library access.
    }
    await this.clearConnectionBestEffort();
    return null;
  }

  private async clearConnectionBestEffort(): Promise<void> {
    await this.dependencies.ownerStorage.deleteItemAsync(OWNER_KEY).catch(() => undefined);
    await this.dependencies.nativeModule?.disconnect().catch(() => undefined);
  }
}

async function currentBeatFitSession(): Promise<BeatFitSession | null> {
  const { data } = await supabase.auth.getSession();
  return data.session
    ? { userId: data.session.user.id, accessToken: data.session.access_token }
    : null;
}

async function getDeveloperToken(
  accessToken: string,
  fetcher: typeof fetch
): Promise<string | undefined> {
  try {
    const response = await fetcher(`${API_BASE_URL}/music/apple/developer-token`, {
      headers: { Authorization: `Bearer ${accessToken}` },
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

function accountChanged() {
  return new AppleMusicError(
    'The BeatFit user changed while Apple Music was connected. Connect again.',
    'expired'
  );
}

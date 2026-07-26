export interface AuthKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface MigratingAuthStorageDependencies {
  secureStorage: AuthKeyValueStorage;
  legacyStorage: AuthKeyValueStorage;
}

/**
 * Keeps native auth sessions in protected storage while lazily moving any
 * session written by the previous AsyncStorage-backed configuration.
 */
export function createMigratingAuthStorage({
  secureStorage,
  legacyStorage,
}: MigratingAuthStorageDependencies): AuthKeyValueStorage {
  return {
    async getItem(key) {
      const secureValue = await secureStorage.getItem(key);
      if (secureValue !== null) return secureValue;

      const legacyValue = await legacyStorage.getItem(key);
      if (legacyValue === null) return null;

      await secureStorage.setItem(key, legacyValue);
      await legacyStorage.removeItem(key);
      return legacyValue;
    },

    async setItem(key, value) {
      await secureStorage.setItem(key, value);
      await legacyStorage.removeItem(key);
    },

    async removeItem(key) {
      await Promise.all([secureStorage.removeItem(key), legacyStorage.removeItem(key)]);
    },
  };
}

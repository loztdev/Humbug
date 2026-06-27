import * as SecureStore from 'expo-secure-store';
import type { ProviderId } from '@/types';

/**
 * API keys are sensitive, so they live in the OS keystore (Android Keystore /
 * iOS Keychain) via expo-secure-store — never in plain AsyncStorage or SQLite.
 * Keys are addressed per provider so users can connect any subset.
 */

const keyName = (id: ProviderId) => `humbug.apikey.${id}`;

export async function setApiKey(id: ProviderId, apiKey: string): Promise<void> {
  if (!apiKey) {
    await SecureStore.deleteItemAsync(keyName(id));
    return;
  }
  await SecureStore.setItemAsync(keyName(id), apiKey, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

export async function getApiKey(id: ProviderId): Promise<string | null> {
  return SecureStore.getItemAsync(keyName(id));
}

export async function hasApiKey(id: ProviderId): Promise<boolean> {
  return (await getApiKey(id)) != null;
}

export async function deleteApiKey(id: ProviderId): Promise<void> {
  await SecureStore.deleteItemAsync(keyName(id));
}

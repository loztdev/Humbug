import { create } from 'zustand';
import type { ProviderId } from '@/types';
import {
  type AppSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from '@/storage/settingsRepo';
import { getApiKey, setApiKey } from '@/storage/secureKeys';
import { PROVIDER_IDS } from '@/providers';

/**
 * Holds app preferences plus which providers have a key configured. Key values
 * themselves never enter the store (only presence), so they aren't kept in JS
 * memory longer than a request needs them.
 */

interface SettingsState {
  settings: AppSettings;
  /** Which providers currently have an API key in the keystore. */
  keyPresence: Record<ProviderId, boolean>;
  loaded: boolean;

  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  saveKey: (id: ProviderId, key: string) => Promise<void>;
}

function emptyPresence(): Record<ProviderId, boolean> {
  return Object.fromEntries(PROVIDER_IDS.map((id) => [id, false])) as Record<
    ProviderId,
    boolean
  >;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  keyPresence: emptyPresence(),
  loaded: false,

  load: async () => {
    const settings = await loadSettings();
    const presence = emptyPresence();
    await Promise.all(
      PROVIDER_IDS.map(async (id) => {
        presence[id] = (await getApiKey(id)) != null;
      }),
    );
    set({ settings, keyPresence: presence, loaded: true });
  },

  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await saveSettings(next);
  },

  saveKey: async (id, key) => {
    await setApiKey(id, key);
    set({ keyPresence: { ...get().keyPresence, [id]: key.length > 0 } });
  },
}));

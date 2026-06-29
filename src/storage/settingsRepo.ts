import type { ProviderId } from '@/types';
import { getDb } from './db';
import { RETENTION } from '@/compaction/retention';

/**
 * App-level settings persisted as a single JSON blob. These are non-secret
 * preferences (which provider/model is active, the embeddings backend, the
 * default compaction retention). API keys are NOT here — see secureKeys.
 */

export interface AppSettings {
  /** Provider used for chat completions. */
  chatProviderId: ProviderId;
  chatModel: string;
  /** Where embeddings come from: an API provider, or on-device. */
  embeddingMode: 'api' | 'local';
  /** Provider used for embeddings in API mode (must be embeddings-capable). */
  embeddingProviderId: ProviderId | null;
  embeddingModel: string | null;
  /** Default system prompt applied to new chats. */
  defaultSystemPromptId: string | null;
  /** Default meaning-retention for compaction (0.5–0.97). */
  compactionRetention: number;
  /** Require device authentication (biometric/PIN) to open the app. */
  appLock: boolean;
  /** Custom OpenAI-compatible endpoint (Ollama, LM Studio, etc.). */
  customBaseUrl: string;
  customModel: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  chatProviderId: 'anthropic',
  chatModel: 'claude-sonnet-4-6',
  embeddingMode: 'api',
  embeddingProviderId: 'openai',
  embeddingModel: 'text-embedding-3-small',
  defaultSystemPromptId: null,
  compactionRetention: RETENTION.default,
  appLock: false,
  customBaseUrl: '',
  customModel: '',
};

const KEY = 'app';

export async function loadSettings(): Promise<AppSettings> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`,
    KEY,
  );
  if (!row) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key,value) VALUES (?,?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    KEY,
    JSON.stringify(s),
  );
}

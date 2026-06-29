import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { getDb } from '@/storage/db';
import { encryptString, decryptString, type EncryptedBlob } from './crypto';

/**
 * Encrypted, portable backup of the whole library (chats, messages, memories,
 * prompts, settings). The payload is JSON, encrypted with the user's passphrase
 * (PBKDF2 + AES). API keys live in the OS keystore and are intentionally NOT
 * included — they never leave the device.
 */

const TABLES = ['chats', 'messages', 'memories', 'system_prompts', 'settings'] as const;

interface BackupFile extends EncryptedBlob {
  humbugBackup: true;
}

async function randomHex(bytes: number): Promise<string> {
  const arr = await Crypto.getRandomBytesAsync(bytes);
  return Array.from(arr)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Build an encrypted backup file and hand it to the OS share sheet. */
export async function createEncryptedBackup(passphrase: string): Promise<string> {
  if (!passphrase) throw new Error('A passphrase is required.');
  const db = await getDb();
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    data[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  }
  const payload = JSON.stringify({ app: 'humbug', schema: 1, data });

  const blob = encryptString(payload, passphrase, await randomHex(16), await randomHex(16));
  const file: BackupFile = { humbugBackup: true, ...blob };

  const uri = `${FileSystem.cacheDirectory}humbug-backup-${Date.now()}.humbug.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(file), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Humbug encrypted backup',
    });
  }
  return uri;
}

export interface RestoreResult {
  chats: number;
  messages: number;
  memories: number;
}

/**
 * Pick a backup file, decrypt it with the passphrase, and replace the local
 * database contents. Returns null if the user cancels the file picker.
 */
export async function restoreEncryptedBackup(passphrase: string): Promise<RestoreResult | null> {
  if (!passphrase) throw new Error('A passphrase is required.');
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (res.canceled || !res.assets[0]) return null;

  const raw = await FileSystem.readAsStringAsync(res.assets[0].uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  let file: BackupFile;
  try {
    file = JSON.parse(raw) as BackupFile;
  } catch {
    throw new Error('That file isn’t a valid Humbug backup.');
  }
  if (!file.humbugBackup) throw new Error('That file isn’t a Humbug backup.');

  const json = decryptString(file, passphrase); // throws on wrong passphrase
  const parsed = JSON.parse(json) as { data: Record<string, Record<string, unknown>[]> };
  const data = parsed.data ?? {};

  const db = await getDb();
  await db.withTransactionAsync(async () => {
    // Delete in FK-safe order (messages reference chats).
    for (const t of ['messages', 'memories', 'system_prompts', 'chats', 'settings'] as const) {
      await db.runAsync(`DELETE FROM ${t}`);
    }
    for (const t of TABLES) {
      for (const row of data[t] ?? []) {
        await insertRow(db, t, row);
      }
    }
  });

  return {
    chats: data.chats?.length ?? 0,
    messages: data.messages?.length ?? 0,
    memories: data.memories?.length ?? 0,
  };
}

/** Insert a row built dynamically from its own columns (rows come from SELECT *). */
async function insertRow(
  db: Awaited<ReturnType<typeof getDb>>,
  table: string,
  row: Record<string, unknown>,
): Promise<void> {
  const cols = Object.keys(row);
  if (cols.length === 0) return;
  const placeholders = cols.map(() => '?').join(',');
  const values = cols.map((c) => row[c] as string | number | null);
  await db.runAsync(
    `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`,
    ...values,
  );
}

import * as SQLite from 'expo-sqlite';

/**
 * SQLite is the local source of truth for chats, messages, memories, and saved
 * system prompts. A single shared connection is opened lazily and migrated on
 * first use. Secrets (API keys) deliberately do NOT live here — see secureKeys.
 */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('humbug.db');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

const SCHEMA_VERSION = 2;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await createBaseTables(db);

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  // v2: add the `pinned` flag to memories (idempotent for fresh installs, which
  // already get the column from createBaseTables).
  if (version < 2) {
    await addColumnIfMissing(db, 'memories', 'pinned', 'INTEGER NOT NULL DEFAULT 0');
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

async function createBaseTables(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      providerId TEXT NOT NULL,
      model TEXT NOT NULL,
      systemPromptId TEXT,
      memoryEnabled INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      chatId TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      attachments TEXT,
      usage TEXT,
      compactionOf TEXT,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chatId, createdAt);

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY NOT NULL,
      sourceChatId TEXT,
      sourceMessageId TEXT,
      content TEXT NOT NULL,
      embedding TEXT,
      embeddingModel TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      lastAccessedAt INTEGER,
      accessCount INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_memories_chat ON memories(sourceChatId);

    CREATE TABLE IF NOT EXISTS system_prompts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}

/** Add a column only if it isn't already present (safe to re-run). */
async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  decl: string,
): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
}

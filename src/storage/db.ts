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

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

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

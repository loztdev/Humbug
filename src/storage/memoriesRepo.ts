import type { MemoryItem } from '@/types';
import { getDb } from './db';
import { newId, now } from '@/utils/id';

/** Persistence for long-term memory items (embeddings stored as JSON). */

interface MemoryRow {
  id: string;
  sourceChatId: string | null;
  sourceMessageId: string | null;
  content: string;
  embedding: string | null;
  embeddingModel: string | null;
  pinned: number;
  createdAt: number;
  lastAccessedAt: number | null;
  accessCount: number;
}

function fromRow(r: MemoryRow): MemoryItem {
  return {
    id: r.id,
    sourceChatId: r.sourceChatId ?? undefined,
    sourceMessageId: r.sourceMessageId ?? undefined,
    content: r.content,
    embedding: r.embedding ? (JSON.parse(r.embedding) as number[]) : undefined,
    embeddingModel: r.embeddingModel ?? undefined,
    pinned: r.pinned === 1,
    createdAt: r.createdAt,
    lastAccessedAt: r.lastAccessedAt ?? undefined,
    accessCount: r.accessCount,
  };
}

export async function listMemories(opts?: { sourceChatId?: string }): Promise<MemoryItem[]> {
  const db = await getDb();
  const rows = opts?.sourceChatId
    ? await db.getAllAsync<MemoryRow>(
        `SELECT * FROM memories WHERE sourceChatId = ? ORDER BY createdAt DESC`,
        opts.sourceChatId,
      )
    : await db.getAllAsync<MemoryRow>(`SELECT * FROM memories ORDER BY createdAt DESC`);
  return rows.map(fromRow);
}

export async function addMemory(init: {
  content: string;
  sourceChatId?: string;
  sourceMessageId?: string;
  pinned?: boolean;
}): Promise<MemoryItem> {
  const db = await getDb();
  const m: MemoryItem = {
    id: newId('mem_'),
    content: init.content,
    sourceChatId: init.sourceChatId,
    sourceMessageId: init.sourceMessageId,
    pinned: init.pinned ?? false,
    createdAt: now(),
    accessCount: 0,
  };
  await db.runAsync(
    `INSERT INTO memories (id,sourceChatId,sourceMessageId,content,embedding,embeddingModel,pinned,createdAt,lastAccessedAt,accessCount)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    m.id,
    m.sourceChatId ?? null,
    m.sourceMessageId ?? null,
    m.content,
    null,
    null,
    m.pinned ? 1 : 0,
    m.createdAt,
    null,
    0,
  );
  return m;
}

/** Persist embeddings backfilled by ensureEmbeddings. */
export async function saveEmbeddings(items: MemoryItem[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const m of items) {
      if (!m.embedding) continue;
      await db.runAsync(
        `UPDATE memories SET embedding = ?, embeddingModel = ? WHERE id = ?`,
        JSON.stringify(m.embedding),
        m.embeddingModel ?? null,
        m.id,
      );
    }
  });
}

/** Bump usage stats when a memory is retrieved, so it surfaces sooner next time. */
export async function markAccessed(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const ts = now();
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync(
        `UPDATE memories SET lastAccessedAt = ?, accessCount = accessCount + 1 WHERE id = ?`,
        ts,
        id,
      );
    }
  });
}

export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE memories SET pinned = ? WHERE id = ?`, pinned ? 1 : 0, id);
}

/** Edit a memory's text. Clears its embedding so it is re-embedded on next use. */
export async function updateMemoryContent(id: string, content: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE memories SET content = ?, embedding = NULL, embeddingModel = NULL WHERE id = ?`,
    content,
    id,
  );
}

export async function searchMemories(query: string, limit = 50): Promise<MemoryItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MemoryRow>(
    `SELECT * FROM memories WHERE content LIKE ? ORDER BY pinned DESC, createdAt DESC LIMIT ?`,
    `%${query}%`,
    limit,
  );
  return rows.map(fromRow);
}

export async function deleteMemory(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM memories WHERE id = ?`, id);
}

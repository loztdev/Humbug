import type { Attachment, Message, Role, TokenUsage } from '@/types';
import { getDb } from './db';

/** Persistence for messages. JSON columns hold attachments/usage/compactionOf. */

interface MessageRow {
  id: string;
  chatId: string;
  role: string;
  content: string;
  attachments: string | null;
  usage: string | null;
  compactionOf: string | null;
  createdAt: number;
}

function fromRow(r: MessageRow): Message {
  return {
    id: r.id,
    chatId: r.chatId,
    role: r.role as Role,
    content: r.content,
    attachments: r.attachments ? (JSON.parse(r.attachments) as Attachment[]) : undefined,
    usage: r.usage ? (JSON.parse(r.usage) as TokenUsage) : undefined,
    compactionOf: r.compactionOf ? (JSON.parse(r.compactionOf) as string[]) : undefined,
    createdAt: r.createdAt,
  };
}

export async function listMessages(chatId: string): Promise<Message[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MessageRow>(
    `SELECT * FROM messages WHERE chatId = ? ORDER BY createdAt ASC`,
    chatId,
  );
  return rows.map(fromRow);
}

export async function searchMessages(q: string, limit = 80): Promise<Message[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MessageRow>(
    `SELECT * FROM messages WHERE content LIKE ? ORDER BY createdAt DESC LIMIT ?`,
    `%${q}%`,
    limit,
  );
  return rows.map(fromRow);
}

export async function insertMessage(m: Message): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO messages (id,chatId,role,content,attachments,usage,compactionOf,createdAt)
     VALUES (?,?,?,?,?,?,?,?)`,
    m.id,
    m.chatId,
    m.role,
    m.content,
    m.attachments ? JSON.stringify(m.attachments) : null,
    m.usage ? JSON.stringify(m.usage) : null,
    m.compactionOf ? JSON.stringify(m.compactionOf) : null,
    m.createdAt,
  );
}

export async function updateMessage(
  id: string,
  patch: Partial<Pick<Message, 'content' | 'usage'>>,
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: (string | null)[] = [];
  if (patch.content !== undefined) {
    fields.push('content = ?');
    values.push(patch.content);
  }
  if (patch.usage !== undefined) {
    fields.push('usage = ?');
    values.push(patch.usage ? JSON.stringify(patch.usage) : null);
  }
  if (fields.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`, ...values);
}

export async function deleteMessage(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM messages WHERE id = ?`, id);
}

/** Replace a set of messages with a single compaction summary message. */
export async function replaceWithSummary(
  chatId: string,
  removeIds: string[],
  summary: Message,
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const id of removeIds) {
      await db.runAsync(`DELETE FROM messages WHERE id = ?`, id);
    }
    await db.runAsync(
      `INSERT INTO messages (id,chatId,role,content,attachments,usage,compactionOf,createdAt)
       VALUES (?,?,?,?,?,?,?,?)`,
      summary.id,
      chatId,
      summary.role,
      summary.content,
      null,
      null,
      summary.compactionOf ? JSON.stringify(summary.compactionOf) : null,
      summary.createdAt,
    );
  });
}

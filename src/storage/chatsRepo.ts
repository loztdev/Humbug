import type { Chat, ProviderId } from '@/types';
import { getDb } from './db';
import { newId, now } from '@/utils/id';

/** Persistence for chats. */

interface ChatRow {
  id: string;
  title: string;
  providerId: string;
  model: string;
  systemPromptId: string | null;
  memoryEnabled: number;
  archived: number;
  createdAt: number;
  updatedAt: number;
}

function fromRow(r: ChatRow): Chat {
  return {
    id: r.id,
    title: r.title,
    providerId: r.providerId as ProviderId,
    model: r.model,
    systemPromptId: r.systemPromptId ?? undefined,
    memoryEnabled: r.memoryEnabled === 1,
    archived: r.archived === 1,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listChats(includeArchived = false): Promise<Chat[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ChatRow>(
    `SELECT * FROM chats ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY updatedAt DESC`,
  );
  return rows.map(fromRow);
}

export async function getChat(id: string): Promise<Chat | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ChatRow>(`SELECT * FROM chats WHERE id = ?`, id);
  return row ? fromRow(row) : null;
}

export async function createChat(init: {
  title?: string;
  providerId: ProviderId;
  model: string;
  systemPromptId?: string;
  memoryEnabled?: boolean;
}): Promise<Chat> {
  const db = await getDb();
  const ts = now();
  const chat: Chat = {
    id: newId('chat_'),
    title: init.title ?? 'New chat',
    providerId: init.providerId,
    model: init.model,
    systemPromptId: init.systemPromptId,
    memoryEnabled: init.memoryEnabled ?? true,
    archived: false,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.runAsync(
    `INSERT INTO chats (id,title,providerId,model,systemPromptId,memoryEnabled,archived,createdAt,updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    chat.id,
    chat.title,
    chat.providerId,
    chat.model,
    chat.systemPromptId ?? null,
    chat.memoryEnabled ? 1 : 0,
    0,
    chat.createdAt,
    chat.updatedAt,
  );
  return chat;
}

export async function updateChat(
  id: string,
  patch: Partial<Pick<Chat, 'title' | 'providerId' | 'model' | 'systemPromptId' | 'memoryEnabled' | 'archived'>>,
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  const set = (col: string, val: string | number | null) => {
    fields.push(`${col} = ?`);
    values.push(val);
  };
  if (patch.title !== undefined) set('title', patch.title);
  if (patch.providerId !== undefined) set('providerId', patch.providerId);
  if (patch.model !== undefined) set('model', patch.model);
  if (patch.systemPromptId !== undefined) set('systemPromptId', patch.systemPromptId ?? null);
  if (patch.memoryEnabled !== undefined) set('memoryEnabled', patch.memoryEnabled ? 1 : 0);
  if (patch.archived !== undefined) set('archived', patch.archived ? 1 : 0);
  set('updatedAt', now());
  if (fields.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE chats SET ${fields.join(', ')} WHERE id = ?`, ...values);
}

export async function touchChat(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE chats SET updatedAt = ? WHERE id = ?`, now(), id);
}

export async function deleteChat(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM chats WHERE id = ?`, id);
}

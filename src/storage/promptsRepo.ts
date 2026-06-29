import type { SystemPrompt } from '@/types';
import { getDb } from './db';
import { newId, now } from '@/utils/id';

/** Persistence for the named system-prompt library. */

export async function listPrompts(): Promise<SystemPrompt[]> {
  const db = await getDb();
  return db.getAllAsync<SystemPrompt>(
    `SELECT * FROM system_prompts ORDER BY updatedAt DESC`,
  );
}

export async function getPrompt(id: string): Promise<SystemPrompt | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SystemPrompt>(
    `SELECT * FROM system_prompts WHERE id = ?`,
    id,
  );
  return row ?? null;
}

export async function createPrompt(name: string, body: string): Promise<SystemPrompt> {
  const db = await getDb();
  const ts = now();
  const p: SystemPrompt = { id: newId('sp_'), name, body, createdAt: ts, updatedAt: ts };
  await db.runAsync(
    `INSERT INTO system_prompts (id,name,body,createdAt,updatedAt) VALUES (?,?,?,?,?)`,
    p.id,
    p.name,
    p.body,
    p.createdAt,
    p.updatedAt,
  );
  return p;
}

export async function updatePrompt(
  id: string,
  patch: Partial<Pick<SystemPrompt, 'name' | 'body'>>,
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: (string | number)[] = [];
  if (patch.name !== undefined) {
    fields.push('name = ?');
    values.push(patch.name);
  }
  if (patch.body !== undefined) {
    fields.push('body = ?');
    values.push(patch.body);
  }
  fields.push('updatedAt = ?');
  values.push(now());
  values.push(id);
  await db.runAsync(`UPDATE system_prompts SET ${fields.join(', ')} WHERE id = ?`, ...values);
}

export async function deletePrompt(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM system_prompts WHERE id = ?`, id);
}

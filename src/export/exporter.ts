import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Chat, Message } from '@/types';
import { listChats } from '@/storage/chatsRepo';
import { listMessages } from '@/storage/messagesRepo';

/**
 * Export chats so users own their data. Supports a single chat or everything,
 * as Markdown (human-readable) or JSON (re-importable). Files are written to
 * the cache dir and handed to the OS share sheet.
 */

export type ExportFormat = 'markdown' | 'json';

function chatToMarkdown(chat: Chat, messages: Message[]): string {
  const header = `# ${chat.title}\n\n_Provider: ${chat.providerId} · Model: ${chat.model} · ${new Date(
    chat.createdAt,
  ).toISOString()}_\n`;
  const body = messages
    .map((m) => {
      const who = m.role === 'user' ? '🧑 User' : m.role === 'assistant' ? '🤖 Assistant' : '⚙️ System';
      return `\n### ${who}\n\n${m.content}\n`;
    })
    .join('\n');
  return `${header}${body}`;
}

interface ChatExport {
  chat: Chat;
  messages: Message[];
}

async function collect(chatIds: string[] | 'all'): Promise<ChatExport[]> {
  const chats = await listChats(true);
  const selected = chatIds === 'all' ? chats : chats.filter((c) => chatIds.includes(c.id));
  return Promise.all(
    selected.map(async (chat) => ({ chat, messages: await listMessages(chat.id) })),
  );
}

async function writeAndShare(filename: string, contents: string, mime: string): Promise<string> {
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, contents, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: 'Export from Humbug' });
  }
  return uri;
}

/** Export a single chat. */
export async function exportChat(chatId: string, format: ExportFormat): Promise<string> {
  const [data] = await collect([chatId]);
  if (!data) throw new Error('Chat not found');
  if (format === 'json') {
    return writeAndShare(
      `humbug-${slug(data.chat.title)}.json`,
      JSON.stringify(data, null, 2),
      'application/json',
    );
  }
  return writeAndShare(
    `humbug-${slug(data.chat.title)}.md`,
    chatToMarkdown(data.chat, data.messages),
    'text/markdown',
  );
}

/** Export every chat into one file. */
export async function exportAll(format: ExportFormat): Promise<string> {
  const all = await collect('all');
  if (format === 'json') {
    return writeAndShare(
      `humbug-export-${Date.now()}.json`,
      JSON.stringify({ exportedAt: Date.now(), chats: all }, null, 2),
      'application/json',
    );
  }
  const md = all.map((d) => chatToMarkdown(d.chat, d.messages)).join('\n\n---\n\n');
  return writeAndShare(`humbug-export-${Date.now()}.md`, md, 'text/markdown');
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'chat';
}

import { create } from 'zustand';
import type { Attachment, Chat, Message, ProviderId } from '@/types';
import { newId, now } from '@/utils/id';
import { getProvider } from '@/providers';
import { toProviderMessage } from '@/files/attachments';
import { getApiKey } from '@/storage/secureKeys';
import {
  createChat as dbCreateChat,
  deleteChat as dbDeleteChat,
  getChat,
  listChats,
  touchChat,
  updateChat,
} from '@/storage/chatsRepo';
import {
  deleteMessage as dbDeleteMessage,
  insertMessage,
  listMessages,
  replaceWithSummary,
} from '@/storage/messagesRepo';
import {
  addMemory,
  listMemories,
  markAccessed,
  saveEmbeddings,
} from '@/storage/memoriesRepo';
import {
  ensureEmbeddings,
  formatMemoryBlock,
  retrieveRelevant,
  type EmbeddingConfig,
} from '@/memory/retrieval';
import { compactConversation } from '@/compaction/compactor';
import { getPrompt } from '@/storage/promptsRepo';
import { useSettings } from './settings';

/**
 * The chat store orchestrates the full send pipeline: persist the user turn,
 * retrieve relevant memories, stream the assistant reply token-by-token, then
 * persist the result and distill the exchange into long-term memory.
 */

interface ChatsState {
  chats: Chat[];
  currentChatId: string | null;
  messages: Message[];
  streaming: boolean;
  streamingId: string | null;
  error: string | null;
  lastMemoryHits: number;

  loadChats: () => Promise<void>;
  newChat: () => Promise<Chat>;
  openChat: (id: string) => Promise<void>;
  closeChat: () => void;
  deleteChat: (id: string) => Promise<void>;
  setChatModel: (id: string, providerId: ProviderId, model: string) => Promise<void>;
  setSystemPrompt: (id: string, promptId: string | null) => Promise<void>;
  toggleMemory: (id: string, enabled: boolean) => Promise<void>;
  send: (text: string, attachments?: Attachment[]) => Promise<void>;
  regenerateLast: () => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  pinMessageToMemory: (message: Message) => Promise<void>;
  /** Remove a message and everything after it; returns its text (for editing). */
  truncateFrom: (messageId: string) => Promise<string | null>;
  /** Fork a new chat containing messages up to and including the given one. */
  branchFrom: (messageId: string) => Promise<string | null>;
  stop: () => void;
  compactCurrent: (retention: number) => Promise<void>;
  clearError: () => void;
}

let abortController: AbortController | null = null;

export const useChats = create<ChatsState>((set, get) => ({
  chats: [],
  currentChatId: null,
  messages: [],
  streaming: false,
  streamingId: null,
  error: null,
  lastMemoryHits: 0,

  loadChats: async () => {
    set({ chats: await listChats() });
  },

  newChat: async () => {
    const { settings } = useSettings.getState();
    const chat = await dbCreateChat({
      providerId: settings.chatProviderId,
      model: settings.chatModel,
      systemPromptId: settings.defaultSystemPromptId ?? undefined,
    });
    set({ chats: [chat, ...get().chats] });
    return chat;
  },

  openChat: async (id) => {
    const messages = await listMessages(id);
    set({ currentChatId: id, messages, error: null, lastMemoryHits: 0 });
  },

  closeChat: () => set({ currentChatId: null, messages: [] }),

  deleteChat: async (id) => {
    await dbDeleteChat(id);
    set((s) => ({
      chats: s.chats.filter((c) => c.id !== id),
      ...(s.currentChatId === id ? { currentChatId: null, messages: [] } : {}),
    }));
  },

  setChatModel: async (id, providerId, model) => {
    await updateChat(id, { providerId, model });
    set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, providerId, model } : c)) }));
  },

  setSystemPrompt: async (id, promptId) => {
    await updateChat(id, { systemPromptId: promptId ?? undefined });
    set((s) => ({
      chats: s.chats.map((c) => (c.id === id ? { ...c, systemPromptId: promptId ?? undefined } : c)),
    }));
  },

  toggleMemory: async (id, enabled) => {
    await updateChat(id, { memoryEnabled: enabled });
    set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, memoryEnabled: enabled } : c)) }));
  },

  stop: () => {
    abortController?.abort();
    abortController = null;
    set({ streaming: false, streamingId: null });
  },

  clearError: () => set({ error: null }),

  send: async (text, attachments) => {
    const chatId = get().currentChatId;
    if (!chatId || get().streaming) return;
    const chat = await getChat(chatId);
    if (!chat) return;

    const apiKey = await getApiKey(chat.providerId);
    if (!apiKey) {
      set({
        error: `No API key set for ${getProvider(chat.providerId).name}. Add one in Settings → Providers.`,
      });
      return;
    }

    const userMsg: Message = {
      id: newId('msg_'),
      chatId,
      role: 'user',
      content: text.trim(),
      attachments: attachments && attachments.length ? attachments : undefined,
      createdAt: now(),
    };
    await insertMessage(userMsg);

    if (chat.title === 'New chat') {
      const title = text.trim().slice(0, 48) || attachments?.[0]?.name || 'New chat';
      await updateChat(chatId, { title });
      set((s) => ({ chats: s.chats.map((c) => (c.id === chatId ? { ...c, title } : c)) }));
    }

    set((s) => ({ messages: [...s.messages, userMsg] }));
    await generateReply(set, get, chat, apiKey, { createMemory: true });
    await get().loadChats();
  },

  regenerateLast: async () => {
    const chatId = get().currentChatId;
    if (!chatId || get().streaming) return;
    const chat = await getChat(chatId);
    if (!chat) return;
    const apiKey = await getApiKey(chat.providerId);
    if (!apiKey) {
      set({ error: 'No API key set for this chat’s provider.' });
      return;
    }
    // Drop the trailing assistant message, then regenerate from the same history.
    const msgs = get().messages;
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== 'assistant') return;
    await dbDeleteMessage(last.id);
    set({ messages: msgs.slice(0, -1) });
    await generateReply(set, get, chat, apiKey, { createMemory: false });
  },

  deleteMessage: async (id) => {
    await dbDeleteMessage(id);
    set((s) => ({ messages: s.messages.filter((m) => m.id !== id) }));
  },

  pinMessageToMemory: async (message) => {
    if (!message.content) return;
    await addMemory({
      content: message.content,
      sourceChatId: message.chatId,
      sourceMessageId: message.id,
      pinned: true,
    });
  },

  truncateFrom: async (messageId) => {
    if (get().streaming) return null;
    const msgs = get().messages;
    const idx = msgs.findIndex((m) => m.id === messageId);
    if (idx < 0) return null;
    for (const m of msgs.slice(idx)) await dbDeleteMessage(m.id);
    set({ messages: msgs.slice(0, idx) });
    return msgs[idx].content;
  },

  branchFrom: async (messageId) => {
    const chatId = get().currentChatId;
    if (!chatId) return null;
    const chat = await getChat(chatId);
    if (!chat) return null;
    const msgs = get().messages;
    const idx = msgs.findIndex((m) => m.id === messageId);
    if (idx < 0) return null;

    const branch = await dbCreateChat({
      title: `${chat.title} (branch)`,
      providerId: chat.providerId,
      model: chat.model,
      systemPromptId: chat.systemPromptId,
      memoryEnabled: chat.memoryEnabled,
    });
    let ts = branch.createdAt;
    for (const m of msgs.slice(0, idx + 1)) {
      await insertMessage({ ...m, id: newId('msg_'), chatId: branch.id, createdAt: ts++ });
    }
    set((s) => ({ chats: [branch, ...s.chats] }));
    return branch.id;
  },

  compactCurrent: async (retention) => {
    const chatId = get().currentChatId;
    if (!chatId || get().streaming) return;
    const chat = await getChat(chatId);
    if (!chat) return;
    const apiKey = await getApiKey(chat.providerId);
    if (!apiKey) {
      set({ error: 'No API key set for this chat’s provider.' });
      return;
    }
    const msgs = get().messages;
    if (msgs.length < 4) {
      set({ error: 'Not enough conversation to compact yet.' });
      return;
    }

    set({ streaming: true, error: null });
    try {
      const result = await compactConversation({
        messages: msgs,
        retention,
        providerId: chat.providerId,
        apiKey,
        model: chat.model,
      });
      const summary: Message = {
        id: newId('msg_'),
        chatId,
        role: 'assistant',
        content: `🗜️ Compacted summary (${Math.round(result.retention * 100)}% meaning kept):\n\n${result.summary}`,
        compactionOf: result.sourceMessageIds,
        createdAt: now(),
      };
      await replaceWithSummary(chatId, result.sourceMessageIds, summary);
      set({ messages: [summary] });
    } catch (e) {
      set({ error: (e as Error)?.message ?? 'Compaction failed' });
    } finally {
      set({ streaming: false });
    }
  },
}));

type Setter = (partial: Partial<ChatsState> | ((s: ChatsState) => Partial<ChatsState>)) => void;
type Getter = () => ChatsState;

/**
 * Shared streaming core used by both send() and regenerateLast(). Assumes the
 * user turn is already in state; appends a streaming assistant placeholder,
 * injects retrieved memory, streams the reply, then persists + (optionally)
 * distills the exchange into memory.
 */
async function generateReply(
  set: Setter,
  get: Getter,
  chat: Chat,
  apiKey: string,
  opts: { createMemory: boolean },
): Promise<void> {
  const chatId = chat.id;
  const lastUser = [...get().messages].reverse().find((m) => m.role === 'user');
  const queryText = lastUser?.content ?? '';

  const assistantMsg: Message = {
    id: newId('msg_'),
    chatId,
    role: 'assistant',
    content: '',
    createdAt: now() + 1,
  };
  set((s) => ({
    messages: [...s.messages, assistantMsg],
    streaming: true,
    streamingId: assistantMsg.id,
    error: null,
  }));

  let system = chat.systemPromptId ? (await getPrompt(chat.systemPromptId))?.body ?? '' : '';
  let memoryHits = 0;
  if (chat.memoryEnabled && queryText) {
    try {
      const block = await buildMemoryBlock(queryText);
      if (block) {
        system = system ? `${system}\n\n${block.text}` : block.text;
        memoryHits = block.count;
      }
    } catch {
      // Memory is best-effort; a missing embeddings key shouldn't block chat.
    }
  }
  set({ lastMemoryHits: memoryHits });

  const history = await Promise.all(
    get()
      .messages.filter((m) => m.id !== assistantMsg.id && (m.content || m.attachments?.length))
      .map(toProviderMessage),
  );

  abortController = new AbortController();
  let acc = '';
  let usage: Message['usage'];
  try {
    for await (const chunk of getProvider(chat.providerId).streamChat(
      { model: chat.model, system: system || undefined, messages: history },
      apiKey,
      abortController.signal,
    )) {
      if (chunk.delta) {
        acc += chunk.delta;
        set((s) => ({
          messages: s.messages.map((m) => (m.id === assistantMsg.id ? { ...m, content: acc } : m)),
        }));
      }
      if (chunk.usage) usage = chunk.usage;
      if (chunk.done) break;
    }
  } catch (e) {
    const msg = (e as Error)?.message ?? 'Request failed';
    set((s) => ({
      error: msg,
      messages: s.messages.map((m) =>
        m.id === assistantMsg.id ? { ...m, content: acc || `⚠️ ${msg}` } : m,
      ),
    }));
  } finally {
    abortController = null;
    set((s) => ({
      streaming: false,
      streamingId: null,
      messages: s.messages.map((m) => (m.id === assistantMsg.id ? { ...m, usage } : m)),
    }));
  }

  await insertMessage({ ...assistantMsg, content: acc, usage });
  await touchChat(chatId);
  if (acc && chat.memoryEnabled && opts.createMemory) {
    if (lastUser) {
      await addMemory({ content: lastUser.content, sourceChatId: chatId, sourceMessageId: lastUser.id });
    }
    await addMemory({ content: acc, sourceChatId: chatId, sourceMessageId: assistantMsg.id });
  }
}

/**
 * Retrieve relevant memories for the query and format them for injection.
 * Backfills embeddings on demand and records access stats. Returns null when
 * memory can't run (no embeddings provider/key) so the caller can skip silently.
 */
async function buildMemoryBlock(query: string): Promise<{ text: string; count: number } | null> {
  const { settings } = useSettings.getState();
  if (!settings.embeddingProviderId) return null;
  const provider = getProvider(settings.embeddingProviderId);
  if (!provider.capabilities.embeddings) return null;
  const apiKey = await getApiKey(settings.embeddingProviderId);
  if (!apiKey) return null;

  const cfg: EmbeddingConfig = {
    providerId: settings.embeddingProviderId,
    apiKey,
    model: settings.embeddingModel ?? provider.defaultEmbeddingModel,
  };

  const all = await listMemories();
  if (all.length === 0) return null;

  const embedded = await ensureEmbeddings(all, cfg);
  await saveEmbeddings(embedded);

  const hits = await retrieveRelevant(query, embedded, cfg, { k: 6 });
  if (hits.length === 0) return null;

  await markAccessed(hits.map((h) => h.item.id));
  return { text: formatMemoryBlock(hits), count: hits.length };
}

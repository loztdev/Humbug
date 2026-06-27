import { create } from 'zustand';
import type { Chat, Message, ProviderId } from '@/types';
import { newId, now } from '@/utils/id';
import { getProvider, type ProviderChatMessage } from '@/providers';
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
  insertMessage,
  listMessages,
  replaceWithSummary,
  updateMessage,
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
  /** Last retrieval count, for a small UI hint ("loaded N memories"). */
  lastMemoryHits: number;

  loadChats: () => Promise<void>;
  newChat: () => Promise<Chat>;
  openChat: (id: string) => Promise<void>;
  closeChat: () => void;
  deleteChat: (id: string) => Promise<void>;
  setChatModel: (id: string, providerId: ProviderId, model: string) => Promise<void>;
  setSystemPrompt: (id: string, promptId: string | null) => Promise<void>;
  toggleMemory: (id: string, enabled: boolean) => Promise<void>;
  send: (text: string) => Promise<void>;
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
    set((s) => ({
      chats: s.chats.map((c) => (c.id === id ? { ...c, providerId, model } : c)),
    }));
  },

  setSystemPrompt: async (id, promptId) => {
    await updateChat(id, { systemPromptId: promptId ?? undefined });
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === id ? { ...c, systemPromptId: promptId ?? undefined } : c,
      ),
    }));
  },

  toggleMemory: async (id, enabled) => {
    await updateChat(id, { memoryEnabled: enabled });
    set((s) => ({
      chats: s.chats.map((c) => (c.id === id ? { ...c, memoryEnabled: enabled } : c)),
    }));
  },

  stop: () => {
    abortController?.abort();
    abortController = null;
    set({ streaming: false, streamingId: null });
  },

  clearError: () => set({ error: null }),

  send: async (text) => {
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

    // 1. Persist the user message.
    const userMsg: Message = {
      id: newId('msg_'),
      chatId,
      role: 'user',
      content: text.trim(),
      createdAt: now(),
    };
    await insertMessage(userMsg);

    // Auto-title from the first user message.
    if (chat.title === 'New chat') {
      const title = text.trim().slice(0, 48) || 'New chat';
      await updateChat(chatId, { title });
      set((s) => ({ chats: s.chats.map((c) => (c.id === chatId ? { ...c, title } : c)) }));
    }

    // 2. Create the streaming assistant placeholder.
    const assistantMsg: Message = {
      id: newId('msg_'),
      chatId,
      role: 'assistant',
      content: '',
      createdAt: now() + 1,
    };
    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      streaming: true,
      streamingId: assistantMsg.id,
      error: null,
    }));

    // 3. Build the system prompt, optionally augmented with retrieved memory.
    let system = chat.systemPromptId
      ? (await getPrompt(chat.systemPromptId))?.body ?? ''
      : '';
    let memoryHits = 0;
    if (chat.memoryEnabled) {
      try {
        const block = await buildMemoryBlock(chatId, text);
        if (block) {
          system = system ? `${system}\n\n${block.text}` : block.text;
          memoryHits = block.count;
        }
      } catch {
        // Memory is best-effort; a missing embeddings key shouldn't block chat.
      }
    }
    set({ lastMemoryHits: memoryHits });

    // 4. Stream the reply.
    const history: ProviderChatMessage[] = [...get().messages]
      .filter((m) => m.id !== assistantMsg.id && m.content)
      .map((m) => ({ role: m.role, content: m.content }));

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
            messages: s.messages.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: acc } : m,
            ),
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
          m.id === assistantMsg.id
            ? { ...m, content: acc || `⚠️ ${msg}` }
            : m,
        ),
      }));
    } finally {
      abortController = null;
      set({ streaming: false, streamingId: null });
    }

    // 5. Persist the final assistant message + distill memory.
    const finalAssistant: Message = { ...assistantMsg, content: acc, usage };
    await insertMessage(finalAssistant);
    await touchChat(chatId);
    if (acc && chat.memoryEnabled) {
      await addMemory({ content: userMsg.content, sourceChatId: chatId, sourceMessageId: userMsg.id });
      await addMemory({ content: acc, sourceChatId: chatId, sourceMessageId: finalAssistant.id });
    }
    await get().loadChats();
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

/**
 * Retrieve relevant memories for the query and format them for injection.
 * Backfills embeddings on demand and records access stats. Returns null when
 * memory can't run (no embeddings provider/key) so the caller can skip silently.
 */
async function buildMemoryBlock(
  chatId: string,
  query: string,
): Promise<{ text: string; count: number } | null> {
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

  // Backfill any missing/stale embeddings and persist them.
  const embedded = await ensureEmbeddings(all, cfg);
  await saveEmbeddings(embedded);

  const hits = await retrieveRelevant(query, embedded, cfg, { k: 6 });
  if (hits.length === 0) return null;

  await markAccessed(hits.map((h) => h.item.id));
  return { text: formatMemoryBlock(hits), count: hits.length };
}

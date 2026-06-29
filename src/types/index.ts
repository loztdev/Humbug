/**
 * Core domain types shared across Humbug.
 * Kept free of any UI or storage-engine specifics so they can be reused
 * by the provider layer, memory engine, compaction, export, and screens.
 */

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'openrouter'
  | 'gemini'
  | 'zai'
  | 'custom';

export type Role = 'system' | 'user' | 'assistant';

/** A file attached to a message (image, document, etc.). */
export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  /** Local file URI (expo-file-system). */
  uri: string;
  sizeBytes: number;
  /** Extracted text, if we were able to parse the document for context. */
  extractedText?: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: Role;
  content: string;
  attachments?: Attachment[];
  createdAt: number;
  /** Token usage reported by the provider for assistant messages. */
  usage?: TokenUsage;
  /** Set when this message is a compaction summary standing in for older turns. */
  compactionOf?: string[];
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface Chat {
  id: string;
  title: string;
  /** Provider + model this chat is currently bound to. */
  providerId: ProviderId;
  model: string;
  /** Optional saved system prompt applied to this chat. */
  systemPromptId?: string;
  createdAt: number;
  updatedAt: number;
  /** Whether the semantic memory engine is active for this chat. */
  memoryEnabled: boolean;
  archived?: boolean;
}

/** A named, reusable system prompt the user can save and apply to chats. */
export interface SystemPrompt {
  id: string;
  name: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * A unit of long-term memory. Can be derived from a chat message or written
 * explicitly by the user/assistant. Embedded for semantic retrieval.
 */
export interface MemoryItem {
  id: string;
  /** Optional source chat/message this memory was distilled from. */
  sourceChatId?: string;
  sourceMessageId?: string;
  content: string;
  /** The embedding vector. Stored alongside the item for retrieval. */
  embedding?: number[];
  /** Model used to produce the embedding (vectors are only comparable within a model). */
  embeddingModel?: string;
  createdAt: number;
  /** Lightweight scoring inputs for ranking beyond pure similarity. */
  lastAccessedAt?: number;
  accessCount?: number;
  /** Pinned memories are always eligible for retrieval and ranked first. */
  pinned?: boolean;
}

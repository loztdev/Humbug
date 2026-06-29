import type { ProviderId, Role, TokenUsage } from '@/types';

/**
 * The provider abstraction. Every supported AI service implements this same
 * interface, so the rest of the app never branches on which provider is active.
 * Adding a new provider = one file + one registry entry.
 */

/** An image carried alongside a message, for vision-capable models. */
export interface ImagePart {
  mimeType: string;
  /** Base64-encoded image data (no data: prefix). */
  dataBase64: string;
}

export interface ProviderChatMessage {
  role: Role;
  content: string;
  /** Optional images; providers that support vision render these inline. */
  images?: ImagePart[];
}

export interface ChatRequest {
  model: string;
  messages: ProviderChatMessage[];
  /** Hoisted system instruction (providers handle this differently internally). */
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatChunk {
  /** Incremental text delta. Empty string is valid (e.g. the final usage chunk). */
  delta: string;
  done: boolean;
  usage?: TokenUsage;
}

export interface ModelInfo {
  id: string;
  /** Human-friendly label, falls back to id. */
  label?: string;
  /** Context window in tokens, when known. */
  contextWindow?: number;
}

export interface ProviderCapabilities {
  /** Whether this provider exposes an embeddings endpoint for the memory engine. */
  embeddings: boolean;
  /** Whether streaming chat is supported (all current providers: true). */
  streaming: boolean;
  /** Whether the model list can be fetched dynamically vs. a static fallback. */
  dynamicModels: boolean;
}

export interface Provider {
  id: ProviderId;
  name: string;
  capabilities: ProviderCapabilities;

  /** Default model id to preselect in the UI. */
  defaultModel: string;
  /** Default embedding model id (only meaningful when capabilities.embeddings). */
  defaultEmbeddingModel?: string;

  /** Static, always-available model list. Used as a fallback / offline. */
  staticModels: ModelInfo[];

  /** Fetch the live model list if the provider supports it. */
  listModels?(apiKey: string): Promise<ModelInfo[]>;

  /** Stream a chat completion as an async generator of text deltas. */
  streamChat(
    req: ChatRequest,
    apiKey: string,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatChunk>;

  /** Produce embeddings. Present only when capabilities.embeddings is true. */
  embed?(texts: string[], apiKey: string, model?: string): Promise<number[][]>;
}

/** Thrown for provider/transport errors with enough context to surface to the user. */
export class ProviderError extends Error {
  constructor(
    public providerId: ProviderId,
    message: string,
    public status?: number,
  ) {
    super(`[${providerId}] ${message}`);
    this.name = 'ProviderError';
  }
}

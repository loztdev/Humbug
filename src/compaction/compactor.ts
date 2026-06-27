import type { Message, ProviderId } from '@/types';
import { getProvider } from '@/providers';
import type { ProviderChatMessage } from '@/providers';
import {
  buildCompactionSystemPrompt,
  clampRetention,
  transcriptOf,
} from './retention';

/**
 * Runtime compaction: streams the model's meaning-preserving summary of a set
 * of messages. Pure math/prompt logic lives in retention.ts (kept separate so
 * it's testable without the provider/network stack).
 */

// Re-export the pure surface so existing imports of '@/compaction/compactor'
// keep working.
export * from './retention';

export interface CompactionInput {
  messages: Message[];
  retention: number;
  providerId: ProviderId;
  apiKey: string;
  model: string;
  signal?: AbortSignal;
}

export interface CompactionResult {
  summary: string;
  retention: number;
  sourceMessageIds: string[];
  /** Rough char-based reduction actually achieved. */
  observedReduction: number;
}

/**
 * Run compaction: stream the model's summary of the given messages. Returns the
 * summary text plus metadata so the caller can replace the compacted messages
 * with a single summary message (see Message.compactionOf).
 */
export async function compactConversation(
  input: CompactionInput,
): Promise<CompactionResult> {
  const provider = getProvider(input.providerId);
  const transcript = transcriptOf(input.messages);

  const chatMessages: ProviderChatMessage[] = [
    { role: 'user', content: `Compact this conversation:\n\n${transcript}` },
  ];

  let summary = '';
  for await (const chunk of provider.streamChat(
    {
      model: input.model,
      system: buildCompactionSystemPrompt(input.retention),
      messages: chatMessages,
      maxTokens: 8192,
    },
    input.apiKey,
    input.signal,
  )) {
    summary += chunk.delta;
    if (chunk.done) break;
  }

  summary = summary.trim();
  const observedReduction =
    transcript.length > 0 ? Math.max(0, 1 - summary.length / transcript.length) : 0;

  return {
    summary,
    retention: clampRetention(input.retention),
    sourceMessageIds: input.messages.map((m) => m.id),
    observedReduction,
  };
}

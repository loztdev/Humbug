import { postSSE, HttpError } from './stream';
import type { ChatChunk, ChatRequest, Provider } from './types';
import { toProviderError } from './openaiCompat';

/**
 * Anthropic (Claude) provider. The Messages API differs from the OpenAI shape:
 * `system` is a top-level field (not a message), `max_tokens` is required, and
 * streaming emits typed SSE events (`content_block_delta`, `message_delta`).
 *
 * Anthropic has no embeddings endpoint, so memory must use a different provider.
 */

const BASE_URL = 'https://api.anthropic.com/v1';
const API_VERSION = '2023-06-01';

// Current Claude models. The live list isn't fetchable without extra scopes,
// so we ship a curated static list and let users type any model id too.
const MODELS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', contextWindow: 1_000_000 },
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', contextWindow: 1_000_000 },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', contextWindow: 1_000_000 },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', contextWindow: 200_000 },
];

export const anthropicProvider: Provider = {
  id: 'anthropic',
  name: 'Anthropic (Claude)',
  capabilities: { embeddings: false, streaming: true, dynamicModels: false },
  defaultModel: 'claude-sonnet-4-6',
  staticModels: MODELS,

  async *streamChat(
    req: ChatRequest,
    apiKey: string,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatChunk> {
    const body = {
      model: req.model,
      // max_tokens is required by Anthropic; default generously for chat.
      max_tokens: req.maxTokens ?? 8192,
      ...(req.system ? { system: req.system } : {}),
      ...(req.temperature != null ? { temperature: req.temperature } : {}),
      messages: req.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    };

    try {
      let inputTokens: number | undefined;
      for await (const ev of postSSE(
        `${BASE_URL}/messages`,
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': API_VERSION,
            // Required to call the API directly from a non-server context.
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body,
        },
        signal,
      )) {
        const data = safeJSON(ev.data);
        if (!data) continue;
        switch (data.type) {
          case 'message_start':
            inputTokens = data.message?.usage?.input_tokens;
            break;
          case 'content_block_delta':
            if (data.delta?.type === 'text_delta') {
              yield { delta: data.delta.text ?? '', done: false };
            }
            break;
          case 'message_delta':
            if (data.usage) {
              yield {
                delta: '',
                done: false,
                usage: {
                  promptTokens: inputTokens,
                  completionTokens: data.usage.output_tokens,
                  totalTokens:
                    (inputTokens ?? 0) + (data.usage.output_tokens ?? 0),
                },
              };
            }
            break;
          case 'message_stop':
            yield { delta: '', done: true };
            return;
          case 'error':
            throw new HttpError(
              data.error?.status ?? 500,
              data.error?.message ?? 'stream error',
            );
        }
      }
      yield { delta: '', done: true };
    } catch (e) {
      throw toProviderError('anthropic', e);
    }
  },
};

function safeJSON(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

import type { ProviderId } from '@/types';
import { postSSE, HttpError } from './stream';
import type {
  ChatChunk,
  ChatRequest,
  ModelInfo,
  Provider,
  ProviderCapabilities,
} from './types';
import { ProviderError } from './types';

/**
 * Factory for any provider that speaks the OpenAI Chat Completions wire format.
 * OpenAI, OpenRouter, and z.ai (Zhipu) all share it, differing only in base URL,
 * headers, model lists, and whether they expose embeddings. New OpenAI-compatible
 * providers can be added with a single config object.
 */

export interface OpenAICompatConfig {
  id: ProviderId;
  name: string;
  /** Base URL, or a getter for endpoints configured at runtime (custom). */
  baseUrl: string | (() => string);
  defaultModel: string;
  staticModels: ModelInfo[];
  capabilities: ProviderCapabilities;
  defaultEmbeddingModel?: string;
  /** Extra headers (e.g. OpenRouter's attribution headers). */
  extraHeaders?: Record<string, string>;
}

export function createOpenAICompatProvider(cfg: OpenAICompatConfig): Provider {
  const base = (): string => (typeof cfg.baseUrl === 'function' ? cfg.baseUrl() : cfg.baseUrl);
  const authHeaders = (apiKey: string): Record<string, string> => ({
    authorization: `Bearer ${apiKey}`,
    ...cfg.extraHeaders,
  });

  const provider: Provider = {
    id: cfg.id,
    name: cfg.name,
    capabilities: cfg.capabilities,
    defaultModel: cfg.defaultModel,
    defaultEmbeddingModel: cfg.defaultEmbeddingModel,
    staticModels: cfg.staticModels,

    async listModels(apiKey: string): Promise<ModelInfo[]> {
      try {
        const res = await fetch(`${base()}/models`, {
          headers: authHeaders(apiKey),
        });
        if (!res.ok) throw new HttpError(res.status, await res.text());
        const json = (await res.json()) as { data?: Array<{ id: string }> };
        const models = (json.data ?? [])
          .map((m) => ({ id: m.id, label: m.id }))
          .sort((a, b) => a.id.localeCompare(b.id));
        return models.length ? models : cfg.staticModels;
      } catch {
        // Fall back to the static list so the UI is never empty.
        return cfg.staticModels;
      }
    },

    async *streamChat(
      req: ChatRequest,
      apiKey: string,
      signal?: AbortSignal,
    ): AsyncGenerator<ChatChunk> {
      const messages = [
        ...(req.system ? [{ role: 'system', content: req.system }] : []),
        ...req.messages.map((m) => ({ role: m.role, content: openAIContent(m) })),
      ];
      const body = {
        model: req.model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(req.temperature != null ? { temperature: req.temperature } : {}),
        ...(req.maxTokens != null ? { max_tokens: req.maxTokens } : {}),
      };

      try {
        for await (const ev of postSSE(
          `${base()}/chat/completions`,
          { headers: authHeaders(apiKey), body },
          signal,
        )) {
          if (ev.data === '[DONE]') {
            yield { delta: '', done: true };
            return;
          }
          const parsed = safeJSON(ev.data);
          if (!parsed) continue;
          const delta: string =
            parsed.choices?.[0]?.delta?.content ?? '';
          const usage = parsed.usage
            ? {
                promptTokens: parsed.usage.prompt_tokens,
                completionTokens: parsed.usage.completion_tokens,
                totalTokens: parsed.usage.total_tokens,
              }
            : undefined;
          if (delta || usage) yield { delta, done: false, usage };
        }
        yield { delta: '', done: true };
      } catch (e) {
        throw toProviderError(cfg.id, e);
      }
    },
  };

  if (cfg.capabilities.embeddings) {
    provider.embed = async (texts, apiKey, model) => {
      try {
        const res = await fetch(`${base()}/embeddings`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authHeaders(apiKey) },
          body: JSON.stringify({
            model: model ?? cfg.defaultEmbeddingModel,
            input: texts,
          }),
        });
        if (!res.ok) throw new HttpError(res.status, await res.text());
        const json = (await res.json()) as {
          data: Array<{ embedding: number[]; index: number }>;
        };
        // Preserve input ordering regardless of how the API returns them.
        return json.data
          .slice()
          .sort((a, b) => a.index - b.index)
          .map((d) => d.embedding);
      } catch (e) {
        throw toProviderError(cfg.id, e);
      }
    };
  }

  return provider;
}

/** OpenAI content: a plain string, or a parts array when images are present. */
function openAIContent(m: { content: string; images?: { mimeType: string; dataBase64: string }[] }) {
  if (!m.images || m.images.length === 0) return m.content;
  const parts: any[] = [];
  if (m.content) parts.push({ type: 'text', text: m.content });
  for (const img of m.images) {
    parts.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${img.dataBase64}` },
    });
  }
  return parts;
}

function safeJSON(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function toProviderError(id: ProviderId, e: unknown): ProviderError {
  if (e instanceof HttpError) {
    return new ProviderError(id, httpHint(id, e.status, e.body), e.status);
  }
  if (e instanceof ProviderError) return e;
  return new ProviderError(id, (e as Error)?.message ?? 'Unknown error');
}

/** Turn raw HTTP failures into actionable, user-facing messages. */
function httpHint(id: ProviderId, status: number, body: string): string {
  switch (status) {
    case 401:
    case 403:
      return 'Invalid or unauthorized API key. Check the key in Settings → Providers.';
    case 404:
      return 'Model or endpoint not found. The selected model may be unavailable for this key.';
    case 429:
      return 'Rate limited. Slow down or check your plan limits.';
    default:
      if (status >= 500) return 'Provider is temporarily unavailable. Try again shortly.';
      return body?.slice(0, 300) || `Request failed (HTTP ${status}).`;
  }
}

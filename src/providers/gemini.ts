import { postSSE, HttpError } from './stream';
import type { ChatChunk, ChatRequest, ModelInfo, Provider } from './types';
import { toProviderError } from './openaiCompat';

/**
 * Google Gemini provider. Uses the Generative Language API, which has its own
 * shape: roles are "user"/"model" (no "system" role — it goes in
 * `systemInstruction`), content is an array of `parts`, and the API key rides
 * in the query string. Gemini does expose embeddings, so it can power memory.
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const MODELS: ModelInfo[] = [
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', contextWindow: 1_000_000 },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', contextWindow: 1_000_000 },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', contextWindow: 1_000_000 },
];

export const geminiProvider: Provider = {
  id: 'gemini',
  name: 'Google Gemini',
  capabilities: { embeddings: true, streaming: true, dynamicModels: true },
  defaultModel: 'gemini-2.5-flash',
  defaultEmbeddingModel: 'text-embedding-004',
  staticModels: MODELS,

  async listModels(apiKey: string): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${BASE_URL}/models?key=${apiKey}`);
      if (!res.ok) throw new HttpError(res.status, await res.text());
      const json = (await res.json()) as {
        models?: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }>;
      };
      const chat = (json.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => ({
          id: m.name.replace(/^models\//, ''),
          label: m.displayName ?? m.name,
        }));
      return chat.length ? chat : MODELS;
    } catch {
      return MODELS;
    }
  },

  async *streamChat(
    req: ChatRequest,
    apiKey: string,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatChunk> {
    const contents = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    const body = {
      contents,
      ...(req.system
        ? { systemInstruction: { parts: [{ text: req.system }] } }
        : {}),
      generationConfig: {
        ...(req.temperature != null ? { temperature: req.temperature } : {}),
        ...(req.maxTokens != null ? { maxOutputTokens: req.maxTokens } : {}),
      },
    };

    const url = `${BASE_URL}/models/${encodeURIComponent(
      req.model,
    )}:streamGenerateContent?alt=sse&key=${apiKey}`;

    try {
      for await (const ev of postSSE(url, { headers: {}, body }, signal)) {
        const data = safeJSON(ev.data);
        if (!data) continue;
        const text: string =
          data.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text ?? '')
            .join('') ?? '';
        const usage = data.usageMetadata
          ? {
              promptTokens: data.usageMetadata.promptTokenCount,
              completionTokens: data.usageMetadata.candidatesTokenCount,
              totalTokens: data.usageMetadata.totalTokenCount,
            }
          : undefined;
        if (text || usage) yield { delta: text, done: false, usage };
      }
      yield { delta: '', done: true };
    } catch (e) {
      throw toProviderError('gemini', e);
    }
  },

  async embed(texts, apiKey, model) {
    const embedModel = model ?? 'text-embedding-004';
    try {
      const res = await fetch(
        `${BASE_URL}/models/${embedModel}:batchEmbedContents?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            requests: texts.map((t) => ({
              model: `models/${embedModel}`,
              content: { parts: [{ text: t }] },
            })),
          }),
        },
      );
      if (!res.ok) throw new HttpError(res.status, await res.text());
      const json = (await res.json()) as {
        embeddings: Array<{ values: number[] }>;
      };
      return json.embeddings.map((e) => e.values);
    } catch (e) {
      throw toProviderError('gemini', e);
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

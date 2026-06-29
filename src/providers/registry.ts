import type { ProviderId } from '@/types';
import { anthropicProvider } from './anthropic';
import { geminiProvider } from './gemini';
import { createOpenAICompatProvider } from './openaiCompat';
import { customProvider } from './custom';
import type { Provider } from './types';

/**
 * Central registry of every supported provider. The rest of the app resolves
 * providers exclusively through here, so adding a new one is a single entry.
 */

const openaiProvider = createOpenAICompatProvider({
  id: 'openai',
  name: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  defaultModel: 'gpt-4o',
  defaultEmbeddingModel: 'text-embedding-3-small',
  capabilities: { embeddings: true, streaming: true, dynamicModels: true },
  staticModels: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'o3', label: 'o3' },
  ],
});

const openrouterProvider = createOpenAICompatProvider({
  id: 'openrouter',
  name: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  defaultModel: 'anthropic/claude-sonnet-4-6',
  // OpenRouter is chat-only; embeddings must come from another provider.
  capabilities: { embeddings: false, streaming: true, dynamicModels: true },
  extraHeaders: {
    'HTTP-Referer': 'https://github.com/loztdev/humbug',
    'X-Title': 'Humbug',
  },
  staticModels: [
    { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'openai/gpt-4o', label: 'GPT-4o' },
    { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  ],
});

const zaiProvider = createOpenAICompatProvider({
  id: 'zai',
  name: 'z.ai (Zhipu)',
  baseUrl: 'https://api.z.ai/api/paas/v4',
  defaultModel: 'glm-4.6',
  defaultEmbeddingModel: 'embedding-3',
  capabilities: { embeddings: true, streaming: true, dynamicModels: false },
  staticModels: [
    { id: 'glm-4.6', label: 'GLM-4.6' },
    { id: 'glm-4.5', label: 'GLM-4.5' },
    { id: 'glm-4.5-air', label: 'GLM-4.5 Air' },
  ],
});

const PROVIDERS: Record<ProviderId, Provider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  openrouter: openrouterProvider,
  gemini: geminiProvider,
  zai: zaiProvider,
  custom: customProvider,
};

export function getProvider(id: ProviderId): Provider {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}

export function allProviders(): Provider[] {
  return Object.values(PROVIDERS);
}

/** Providers that can produce embeddings — the only valid memory backends. */
export function embeddingProviders(): Provider[] {
  return allProviders().filter((p) => p.capabilities.embeddings);
}

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

/** Best-known context window (tokens) for a provider+model, with a safe default. */
export function contextWindowFor(providerId: ProviderId, model: string): number {
  const m = PROVIDERS[providerId]?.staticModels.find((x) => x.id === model);
  return m?.contextWindow ?? 128_000;
}

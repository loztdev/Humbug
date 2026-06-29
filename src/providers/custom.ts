import { createOpenAICompatProvider } from './openaiCompat';
import type { Provider } from './types';

/**
 * A user-configurable OpenAI-compatible endpoint — for Ollama, LM Studio,
 * vLLM, OpenRouter alternates, or any self-hosted server speaking the OpenAI
 * Chat Completions API. The base URL and model are set in Settings at runtime,
 * so this provider reads them from a mutable config rather than baking them in.
 */

export const customConfig = { baseUrl: '', model: '' };

export function setCustomConfig(c: { baseUrl: string; model: string }): void {
  customConfig.baseUrl = c.baseUrl.replace(/\/+$/, '');
  customConfig.model = c.model;
}

export const customProvider: Provider = createOpenAICompatProvider({
  id: 'custom',
  name: 'Custom endpoint',
  baseUrl: () => customConfig.baseUrl,
  defaultModel: '',
  staticModels: [],
  capabilities: { embeddings: false, streaming: true, dynamicModels: true },
});

// Surface the runtime-configured model through the static fields the UI reads.
Object.defineProperty(customProvider, 'staticModels', {
  get() {
    return customConfig.model ? [{ id: customConfig.model, label: customConfig.model }] : [];
  },
});
Object.defineProperty(customProvider, 'defaultModel', {
  get() {
    return customConfig.model || '';
  },
});

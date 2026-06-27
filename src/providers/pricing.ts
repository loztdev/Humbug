import type { ProviderId, TokenUsage } from '@/types';

/**
 * Approximate per-model pricing in USD per 1M tokens, used for the cost meter.
 * These are estimates and can drift; OpenRouter is omitted because its pricing
 * is per-model and dynamic. Unknown models fall back to "tokens only" in the UI.
 */

interface Price {
  in: number;
  out: number;
}

const TABLE: Partial<Record<ProviderId, Record<string, Price>>> = {
  anthropic: {
    'claude-opus-4-8': { in: 5, out: 25 },
    'claude-opus-4-7': { in: 5, out: 25 },
    'claude-sonnet-4-6': { in: 3, out: 15 },
    'claude-haiku-4-5': { in: 1, out: 5 },
    'claude-fable-5': { in: 10, out: 50 },
  },
  openai: {
    'gpt-4o': { in: 2.5, out: 10 },
    'gpt-4o-mini': { in: 0.15, out: 0.6 },
    'gpt-4.1': { in: 2, out: 8 },
    o3: { in: 2, out: 8 },
  },
  gemini: {
    'gemini-2.5-pro': { in: 1.25, out: 10 },
    'gemini-2.5-flash': { in: 0.3, out: 2.5 },
    'gemini-2.0-flash': { in: 0.1, out: 0.4 },
  },
  zai: {
    'glm-4.6': { in: 0.6, out: 2.2 },
    'glm-4.5': { in: 0.6, out: 2.2 },
    'glm-4.5-air': { in: 0.2, out: 1.1 },
  },
};

export function priceFor(providerId: ProviderId, model: string): Price | null {
  return TABLE[providerId]?.[model] ?? null;
}

/** Cost in USD for a single usage record, or null when pricing is unknown. */
export function costOf(
  providerId: ProviderId,
  model: string,
  usage?: TokenUsage,
): number | null {
  const p = priceFor(providerId, model);
  if (!p || !usage) return null;
  const inTok = usage.promptTokens ?? 0;
  const outTok = usage.completionTokens ?? 0;
  if (!inTok && !outTok) return null;
  return (inTok * p.in + outTok * p.out) / 1_000_000;
}

export function formatCost(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

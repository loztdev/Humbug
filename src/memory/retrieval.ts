import type { MemoryItem, ProviderId } from '@/types';
import { getProvider } from '@/providers';
import { topK, type Scored } from './similarity';

/**
 * The semantic memory engine — the core of "load only what's relevant".
 *
 * Instead of stuffing an entire chat history into every request, we embed each
 * memory once, then at query time embed the user's message and retrieve only
 * the top-K most relevant memories. Final ranking blends pure similarity with
 * light recency/frequency boosts so freshly-used context surfaces first.
 */

export interface EmbeddingConfig {
  providerId: ProviderId;
  apiKey: string;
  model?: string;
}

export interface RetrievalOptions {
  /** How many memories to inject. */
  k?: number;
  /** Minimum cosine similarity to be eligible (filters noise). */
  minScore?: number;
  /** Weight of the recency/frequency boost relative to similarity (0..1). */
  recencyWeight?: number;
}

const DEFAULTS: Required<RetrievalOptions> = {
  k: 6,
  minScore: 0.15,
  recencyWeight: 0.15,
};

/** Embed one or more strings using the configured embeddings provider. */
export async function embedTexts(
  texts: string[],
  cfg: EmbeddingConfig,
): Promise<number[][]> {
  const provider = getProvider(cfg.providerId);
  if (!provider.embed) {
    throw new Error(
      `${provider.name} cannot produce embeddings. Choose an embeddings provider (OpenAI, Gemini, or z.ai) for memory.`,
    );
  }
  return provider.embed(texts, cfg.apiKey, cfg.model);
}

/**
 * Retrieve the most relevant memories for a query. Embeds the query, scores
 * every stored memory by cosine similarity, applies a recency/frequency boost,
 * and returns the top-K above the threshold.
 *
 * Memories must already carry an `embedding` produced by the SAME model — see
 * `ensureEmbeddings` to backfill any that don't.
 */
export async function retrieveRelevant(
  query: string,
  memories: MemoryItem[],
  cfg: EmbeddingConfig,
  opts: RetrievalOptions = {},
): Promise<Scored<MemoryItem>[]> {
  const o = { ...DEFAULTS, ...opts };
  if (memories.length === 0) return [];

  const [queryVec] = await embedTexts([query], cfg);

  // Only compare against memories embedded with the same model — vectors from
  // different models live in different spaces and aren't comparable.
  const comparable = memories.filter(
    (m) => m.embedding && m.embeddingModel === (cfg.model ?? defaultModel(cfg)),
  );

  const ranked = topK(queryVec, comparable, (m) => m.embedding, o.k * 3);

  const now = Date.now();
  const boosted = ranked
    // Pinned memories bypass the relevance threshold — the user marked them
    // important, so they're always eligible.
    .filter((r) => r.item.pinned || r.score >= o.minScore)
    .map((r) => ({
      item: r.item,
      score:
        r.score * (1 - o.recencyWeight) +
        recencyBoost(r.item, now) * o.recencyWeight +
        (r.item.pinned ? 0.5 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, o.k);

  return boosted;
}

/**
 * Backfill embeddings for any memories missing them (or embedded with a
 * different model). Batches to one network call. Returns updated copies; the
 * caller persists them.
 */
export async function ensureEmbeddings(
  memories: MemoryItem[],
  cfg: EmbeddingConfig,
): Promise<MemoryItem[]> {
  const model = cfg.model ?? defaultModel(cfg);
  const stale = memories.filter(
    (m) => !m.embedding || m.embeddingModel !== model,
  );
  if (stale.length === 0) return memories;

  const vectors = await embedTexts(stale.map((m) => m.content), cfg);
  const byId = new Map(
    stale.map((m, i) => [m.id, { ...m, embedding: vectors[i], embeddingModel: model }]),
  );
  return memories.map((m) => byId.get(m.id) ?? m);
}

/** Format retrieved memories into a block for injection into the system prompt. */
export function formatMemoryBlock(scored: Scored<MemoryItem>[]): string {
  if (scored.length === 0) return '';
  const lines = scored.map((s) => `- ${s.item.content}`);
  return [
    'Relevant context from earlier (retrieved by semantic memory):',
    ...lines,
  ].join('\n');
}

function recencyBoost(m: MemoryItem, now: number): number {
  // Exponential decay over ~30 days, nudged up by access frequency.
  const ageMs = now - (m.lastAccessedAt ?? m.createdAt);
  const days = ageMs / (1000 * 60 * 60 * 24);
  const recency = Math.exp(-days / 30); // 1.0 today → ~0.37 at 30 days
  const freq = Math.min((m.accessCount ?? 0) / 10, 1); // saturates at 10 uses
  return Math.max(recency, freq * 0.5);
}

function defaultModel(cfg: EmbeddingConfig): string {
  return getProvider(cfg.providerId).defaultEmbeddingModel ?? 'unknown';
}

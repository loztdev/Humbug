/**
 * Vector math for semantic memory. Embeddings are compared with cosine
 * similarity; everything here is pure and dependency-free so it can be unit
 * tested and run on-device without native modules.
 */

export function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

export function magnitude(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

/** Cosine similarity in [-1, 1]. Returns 0 for a zero-length vector. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const m = magnitude(a) * magnitude(b);
  return m === 0 ? 0 : dot(a, b) / m;
}

export interface Scored<T> {
  item: T;
  score: number;
}

/**
 * Rank items by cosine similarity to a query vector and return the top K.
 * `getVector` extracts the embedding from each item; items without one are
 * skipped rather than throwing.
 */
export function topK<T>(
  query: number[],
  items: T[],
  getVector: (item: T) => number[] | undefined,
  k: number,
): Scored<T>[] {
  const scored: Scored<T>[] = [];
  for (const item of items) {
    const v = getVector(item);
    if (!v || v.length === 0) continue;
    scored.push({ item, score: cosineSimilarity(query, v) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

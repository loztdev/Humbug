/**
 * On-device, zero-dependency embeddings via feature hashing (the "hashing
 * trick"). Tokens are hashed into a fixed-dimension vector with signed buckets,
 * then L2-normalized so cosine similarity behaves. This is lighter than a
 * neural embedding model — it captures lexical/keyword overlap rather than deep
 * semantics — but it needs no API key, no network, and no native runtime, which
 * makes it a solid "works offline" option the user can choose.
 */

export const LOCAL_EMBEDDING_MODEL = 'local-hash-v1';
const DIM = 256;

export function embedLocal(texts: string[]): number[][] {
  return texts.map(embedOne);
}

function embedOne(text: string): number[] {
  const v = new Array<number>(DIM).fill(0);
  for (const tok of tokenize(text)) {
    const h = fnv1a(tok);
    const idx = h % DIM;
    const sign = (h >>> 16) & 1 ? 1 : -1;
    v[idx] += sign;
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

/** FNV-1a 32-bit string hash → unsigned int. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

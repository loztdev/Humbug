import { cosineSimilarity, topK } from '@/memory/similarity';
import {
  clampRetention,
  targetLengthFraction,
  gainsAssessment,
  RETENTION,
} from '@/compaction/retention';
import { costOf, formatCost } from '@/providers/pricing';

describe('similarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });
  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it('handles zero vectors without NaN', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
  it('topK ranks by similarity and skips vector-less items', () => {
    const items = [
      { id: 'a', v: [1, 0] },
      { id: 'b', v: [0.9, 0.1] },
      { id: 'c', v: undefined as number[] | undefined },
    ];
    const out = topK([1, 0], items, (i) => i.v, 2);
    expect(out.map((s) => s.item.id)).toEqual(['a', 'b']);
  });
});

describe('compaction retention', () => {
  it('clamps to the supported 50%–97% range', () => {
    expect(clampRetention(0.1)).toBe(RETENTION.min);
    expect(clampRetention(1.5)).toBe(RETENTION.max);
  });
  it('keeps more text as retention rises (monotonic)', () => {
    let prev = 0;
    for (const r of [0.5, 0.6, 0.7, 0.8, 0.9, 0.97]) {
      const f = targetLengthFraction(r);
      expect(f).toBeGreaterThan(prev);
      prev = f;
    }
  });
  it('flags low-gain settings as not worthwhile', () => {
    // At max retention, reduction is modest but still > 12%, so worthwhile.
    expect(gainsAssessment(RETENTION.max).worthwhile).toBe(true);
    // Mid settings should always be worthwhile.
    expect(gainsAssessment(0.7).worthwhile).toBe(true);
    expect(gainsAssessment(0.7).estimatedReduction).toBeGreaterThan(0.12);
  });
});

describe('pricing', () => {
  it('computes cost from token usage for a known model', () => {
    // Sonnet 4.6: $3/1M in, $15/1M out → 1000 in + 1000 out = 0.003 + 0.015.
    const c = costOf('anthropic', 'claude-sonnet-4-6', {
      promptTokens: 1000,
      completionTokens: 1000,
    });
    expect(c).toBeCloseTo(0.018, 6);
  });
  it('returns null for unknown pricing (e.g. OpenRouter)', () => {
    expect(costOf('openrouter', 'anything', { totalTokens: 100 })).toBeNull();
  });
  it('formats small costs with more precision', () => {
    expect(formatCost(0.0004)).toBe('$0.0004');
    expect(formatCost(2.5)).toBe('$2.50');
  });
});

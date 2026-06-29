/**
 * Pure compaction math and prompt construction — no provider/native deps, so it
 * can be unit-tested headless and imported by settings without pulling the
 * network stack. The runtime `compactConversation` lives in compactor.ts.
 *
 * Design decision: the slider runs 50%–97%, NOT to 100%. At true 100% there is
 * no summarization, so there are zero token savings — it would be a no-op that
 * costs an API call. `gainsAssessment` surfaces that honestly rather than offer
 * a setting that can't help.
 */

import type { Message } from '@/types';

export const RETENTION = {
  min: 0.5,
  max: 0.97,
  default: 0.8,
  /** Above this, gains shrink fast — we warn but still allow it. */
  diminishing: 0.92,
} as const;

export function clampRetention(r: number): number {
  return Math.min(RETENTION.max, Math.max(RETENTION.min, r));
}

/**
 * Map a meaning-retention ratio to an approximate fraction of the original
 * token count to keep. Preserving more meaning means keeping more text, but the
 * relationship is sub-linear: a lot of conversation is redundant, so even at
 * high retention we can shed real volume.
 */
export function targetLengthFraction(retention: number): number {
  const r = clampRetention(retention);
  // 0.50 → ~0.15, 0.80 → ~0.34, 0.90 → ~0.50, 0.97 → ~0.70
  return Number((0.15 + Math.pow((r - 0.5) / 0.47, 1.4) * 0.55).toFixed(3));
}

export interface GainsAssessment {
  /** Estimated fraction of tokens removed (0..1). */
  estimatedReduction: number;
  /** Whether compaction is worth running at this setting. */
  worthwhile: boolean;
  message: string;
}

/** Honest assessment of whether compacting at a given retention is worth it. */
export function gainsAssessment(retention: number): GainsAssessment {
  const reduction = 1 - targetLengthFraction(retention);
  if (reduction < 0.12) {
    return {
      estimatedReduction: reduction,
      worthwhile: false,
      message:
        'At this setting almost nothing is removed — the token savings don’t justify the rewrite. Lower the slider to actually free up context.',
    };
  }
  if (retention >= RETENTION.diminishing) {
    return {
      estimatedReduction: reduction,
      worthwhile: true,
      message:
        'High fidelity: meaning is nearly fully preserved, with modest space savings. Good for important threads you don’t want to risk.',
    };
  }
  return {
    estimatedReduction: reduction,
    worthwhile: true,
    message: `Estimated ~${Math.round(
      reduction * 100,
    )}% smaller while keeping ~${Math.round(retention * 100)}% of the meaning.`,
  };
}

/** Build the compaction instruction sent as the system prompt. */
export function buildCompactionSystemPrompt(retention: number): string {
  const r = clampRetention(retention);
  const pct = Math.round(r * 100);
  const keepFrac = targetLengthFraction(r);
  return [
    'You are a conversation compactor. Rewrite the conversation below into a dense,',
    'self-contained summary that a language model can use to continue the conversation',
    'seamlessly, as if it had read the full history.',
    '',
    `Hard requirement: preserve at least ${pct}% of the original meaning. Prioritise, in order:`,
    '1. Decisions, conclusions, and commitments made.',
    '2. Concrete facts, names, numbers, code, file paths, and constraints.',
    '3. Unresolved questions and open threads.',
    '4. The user’s goals, preferences, and tone.',
    '',
    `Aim for roughly ${Math.round(
      keepFrac * 100,
    )}% of the original length. Drop pleasantries, repetition, and verbose phrasing,`,
    'but NEVER drop a fact or decision to hit the length target — fidelity wins over brevity.',
    '',
    'Output only the summary. Use compact structured notes (short headings + bullets).',
    'Do not add commentary about the compaction itself.',
  ].join('\n');
}

/** Serialize messages into a single transcript block for the compactor. */
export function transcriptOf(messages: Message[]): string {
  return messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
}

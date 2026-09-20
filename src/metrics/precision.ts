// ─────────────────────────────────────────────────────
// gz-eval — Precision@K
// Fraction of retrieved items that are relevant
// ─────────────────────────────────────────────────────

import type { MetricFn } from '../core/types.js'
import { tokenize, jaccard } from './utils.js'

/**
 * Precision@K = |relevant ∩ retrieved| / |retrieved|
 *
 * Compares expectedContext against actualContext using token overlap.
 * If no context is provided, falls back to comparing expected vs actual answer.
 *
 * Score 1.0 = all retrieved items are relevant
 * Score 0.0 = no retrieved items are relevant
 */
export const precisionMetric: MetricFn = (
  expectedAnswer,
  actualAnswer,
  context,
  expectedContext
) => {
  // If both contexts are available, use them
  if (expectedContext && expectedContext.length > 0 && context && context.length > 0) {
    const expectedTokens = new Set(expectedContext.flatMap(tokenize))
    const actualTokens = new Set(context.flatMap(tokenize))

    if (actualTokens.size === 0) {
      return { name: 'precision', score: 0, details: { reason: 'no retrieved tokens' } }
    }

    const intersection = new Set([...expectedTokens].filter((t) => actualTokens.has(t)))
    const score = intersection.size / actualTokens.size

    return {
      name: 'precision',
      score: Math.min(1, Math.max(0, score)),
      details: {
        expectedTokenCount: expectedTokens.size,
        retrievedTokenCount: actualTokens.size,
        overlapCount: intersection.size,
      },
    }
  }

  // Fallback: compare answer against expected answer using Jaccard similarity
  const score = jaccard(tokenize(expectedAnswer), tokenize(actualAnswer))

  return {
    name: 'precision',
    score,
    details: { method: 'answer-jaccard' },
  }
}

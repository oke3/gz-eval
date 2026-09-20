// ─────────────────────────────────────────────────────
// gz-eval — Recall@K
// Fraction of expected items that were retrieved
// ─────────────────────────────────────────────────────

import type { MetricFn } from '../core/types.js'
import { tokenize, jaccard } from './utils.js'

/**
 * Recall@K = |relevant ∩ retrieved| / |relevant|
 *
 * Compares expectedContext against actualContext.
 * If no context is provided, falls back to comparing expected vs actual answer.
 *
 * Score 1.0 = all relevant items were retrieved
 * Score 0.0 = no relevant items were retrieved
 */
export const recallMetric: MetricFn = (
  expectedAnswer,
  actualAnswer,
  context,
  expectedContext
) => {
  if (expectedContext && expectedContext.length > 0 && context && context.length > 0) {
    const expectedTokens = new Set(expectedContext.flatMap(tokenize))
    const actualTokens = new Set(context.flatMap(tokenize))

    if (expectedTokens.size === 0) {
      return { name: 'recall', score: 1, details: { reason: 'no expected tokens' } }
    }

    const intersection = new Set([...expectedTokens].filter((t) => actualTokens.has(t)))
    const score = intersection.size / expectedTokens.size

    return {
      name: 'recall',
      score: Math.min(1, Math.max(0, score)),
      details: {
        expectedTokenCount: expectedTokens.size,
        retrievedTokenCount: actualTokens.size,
        overlapCount: intersection.size,
      },
    }
  }

  // Fallback: compare answer against expected answer
  const score = jaccard(tokenize(expectedAnswer), tokenize(actualAnswer))

  return {
    name: 'recall',
    score,
    details: { method: 'answer-jaccard' },
  }
}

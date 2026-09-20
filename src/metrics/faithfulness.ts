// ─────────────────────────────────────────────────────
// gz-eval — Faithfulness
// Does the answer align with the provided context?
// ─────────────────────────────────────────────────────

import type { MetricFn } from '../core/types.js'
import { tokenize, cosineSimilarity } from './utils.js'

/**
 * Faithfulness checks whether the actual answer is supported by the context.
 *
 * Algorithm:
 * 1. Split answer into claims (sentences)
 * 2. For each claim, check if any context passage has high similarity
 * 3. Score = supported_claims / total_claims
 *
 * Score 1.0 = all claims are supported by context
 * Score 0.0 = no claims are supported by context
 */
export const faithfulnessMetric: MetricFn = (
  _expectedAnswer,
  actualAnswer,
  context
) => {
  if (!context || context.length === 0) {
    // No context to check against — neutral score
    return {
      name: 'faithfulness',
      score: 0.5,
      details: { reason: 'no context provided for faithfulness check' },
    }
  }

  if (!actualAnswer || actualAnswer.trim().length === 0) {
    return { name: 'faithfulness', score: 0, details: { reason: 'empty answer' } }
  }

  // Split into sentences (claims)
  const claims = splitIntoSentences(actualAnswer)
  if (claims.length === 0) {
    return { name: 'faithfulness', score: 1, details: { reason: 'no claims to check' } }
  }

  // Tokenize context into a single bag of words
  const contextTokens = context.flatMap(tokenize)
  const contextSet = new Set(contextTokens)
  const contextVec = tokensToVec(contextTokens)

  let supportedCount = 0
  const claimDetails: Array<{ claim: string; score: number; supported: boolean }> = []

  for (const claim of claims) {
    const claimTokens = tokenize(claim)
    if (claimTokens.length === 0) continue

    // Check overlap with context
    const claimVec = tokensToVec(claimTokens)

    // Cosine similarity between claim and combined context
    const sim = cosineSimilarity(claimVec, contextVec)

    // Also check token overlap ratio
    const overlapTokens = claimTokens.filter((t) => contextSet.has(t))
    const overlapRatio = claimTokens.length > 0 ? overlapTokens.length / claimTokens.length : 0

    // Combined score: weighted average of cosine similarity and overlap
    const combinedScore = sim * 0.5 + overlapRatio * 0.5
    const supported = combinedScore >= 0.2

    if (supported) supportedCount++
    claimDetails.push({ claim: claim.slice(0, 100), score: combinedScore, supported })
  }

  const score = claims.length > 0 ? supportedCount / claims.length : 1

  return {
    name: 'faithfulness',
    score: Math.min(1, Math.max(0, score)),
    details: {
      totalClaims: claims.length,
      supportedClaims: supportedCount,
      claimBreakdown: claimDetails,
    },
  }
}

/** Split text into sentences */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
}

/** Convert token array to frequency vector */
function tokensToVec(tokens: string[]): Map<string, number> {
  const vec = new Map<string, number>()
  for (const t of tokens) {
    vec.set(t, (vec.get(t) || 0) + 1)
  }
  return vec
}

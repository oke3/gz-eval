// ─────────────────────────────────────────────────────
// gz-eval — Hallucination Detection
// Does the answer contain unsupported claims?
// ─────────────────────────────────────────────────────

import type { MetricFn } from '../core/types.js'
import { tokenize, cosineSimilarity } from './utils.js'

/**
 * Hallucination detection checks whether the answer contains claims
 * not supported by the context.
 *
 * Algorithm:
 * 1. Split answer into sentences
 * 2. For each sentence, check if it's supported by context
 * 3. Score = 1 - (unsupported_sentences / total_sentences)
 *
 * Score 1.0 = no hallucinations detected
 * Score 0.0 = all sentences are hallucinated
 */
export const hallucinationMetric: MetricFn = (
  _expectedAnswer,
  actualAnswer,
  context
) => {
  if (!context || context.length === 0) {
    // Without context, we can't detect hallucinations
    return {
      name: 'hallucination',
      score: 0.5,
      details: { reason: 'no context provided for hallucination check' },
    }
  }

  if (!actualAnswer || actualAnswer.trim().length === 0) {
    return { name: 'hallucination', score: 1, details: { reason: 'empty answer' } }
  }

  const sentences = splitIntoSentences(actualAnswer)
  if (sentences.length === 0) {
    return { name: 'hallucination', score: 1, details: { reason: 'no sentences to check' } }
  }

  // Build context token frequency map
  const contextTokens = context.flatMap(tokenize)
  const contextVec = tokensToVec(contextTokens)

  let unsupportedCount = 0
  const sentenceDetails: Array<{
    sentence: string
    supportScore: number
    supported: boolean
  }> = []

  for (const sentence of sentences) {
    const sentTokens = tokenize(sentence)
    if (sentTokens.length === 0) continue

    const sentVec = tokensToVec(sentTokens)

    // Cosine similarity between sentence and context
    const cosSim = cosineSimilarity(sentVec, contextVec)

    // Token overlap ratio
    const contextSet = new Set(contextTokens)
    const overlap = sentTokens.filter((t) => contextSet.has(t))
    const overlapRatio = sentTokens.length > 0 ? overlap.length / sentTokens.length : 0

    // Combined support score
    const supportScore = cosSim * 0.4 + overlapRatio * 0.6

    // Threshold: if support is below 0.15, consider it a hallucination
    const supported = supportScore >= 0.15
    if (!supported) unsupportedCount++

    sentenceDetails.push({
      sentence: sentence.slice(0, 100),
      supportScore,
      supported,
    })
  }

  const score = sentences.length > 0
    ? 1 - (unsupportedCount / sentences.length)
    : 1

  return {
    name: 'hallucination',
    score: Math.min(1, Math.max(0, score)),
    details: {
      totalSentences: sentences.length,
      unsupportedSentences: unsupportedCount,
      supportedSentences: sentences.length - unsupportedCount,
      sentenceBreakdown: sentenceDetails,
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

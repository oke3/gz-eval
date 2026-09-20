// ─────────────────────────────────────────────────────
// gz-eval — Relevance
// Does the answer address the query?
// ─────────────────────────────────────────────────────

import type { MetricFn } from '../core/types.js'
import { tokenize } from './utils.js'

/**
 * Relevance checks whether the answer addresses the query.
 *
 * Algorithm:
 * 1. Extract key terms from the query (remove stopwords)
 * 2. Count how many appear in the answer
 * 3. Score = matching_terms / query_terms
 *
 * Score 1.0 = answer covers all query terms
 * Score 0.0 = answer covers none of the query terms
 */
export const relevanceMetric: MetricFn = (
  expectedAnswer,
  actualAnswer
) => {
  if (!actualAnswer || actualAnswer.trim().length === 0) {
    return { name: 'relevance', score: 0, details: { reason: 'empty answer' } }
  }

  // Tokenize and remove stopwords from the query
  const queryTokens = tokenize(expectedAnswer).filter((t) => !STOPWORDS.has(t))
  const answerTokens = new Set(tokenize(actualAnswer))

  if (queryTokens.length === 0) {
    return { name: 'relevance', score: 1, details: { reason: 'no query terms after filtering' } }
  }

  const matching = queryTokens.filter((t) => answerTokens.has(t))
  const score = matching.length / queryTokens.length

  return {
    name: 'relevance',
    score: Math.min(1, Math.max(0, score)),
    details: {
      queryTerms: queryTokens.length,
      matchingTerms: matching.length,
      matchedWords: matching,
      unmatchedWords: queryTokens.filter((t) => !answerTokens.has(t)),
    },
  }
}

/** Common English stopwords */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'can', 'shall', 'must', 'need',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'me', 'my',
  'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'their',
  'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why',
  'not', 'no', 'nor', 'so', 'too', 'very', 'just', 'about', 'above',
  'after', 'again', 'all', 'also', 'am', 'any', 'as', 'because',
  'before', 'below', 'between', 'both', 'each', 'few', 'get', 'got',
  'here', 'if', 'into', 'more', 'most', 'now', 'only', 'other', 'own',
  'same', 'than', 'then', 'there', 'through', 'under', 'until', 'up',
  'while', 'some', 'such', 'out', 'over', 'down',
])

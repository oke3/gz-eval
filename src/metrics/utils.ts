// ─────────────────────────────────────────────────────
// gz-eval — Metric Utilities
// Shared helpers for tokenization, similarity, etc.
// ─────────────────────────────────────────────────────

/** Tokenize text into lowercase word tokens */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0)
}

/** Jaccard similarity between two token arrays */
export function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  if (setA.size === 0 && setB.size === 0) return 1
  const intersection = new Set([...setA].filter((x) => setB.has(x)))
  const union = new Set([...setA, ...setB])
  return union.size === 0 ? 0 : intersection.size / union.size
}

/** Cosine similarity between two frequency vectors */
export function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  // Dot product and norms for a
  for (const [key, val] of a) {
    normA += val * val
    const bVal = b.get(key)
    if (bVal !== undefined) {
      dotProduct += val * bVal
    }
  }

  // Norm for b
  for (const val of b.values()) {
    normB += val * val
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/** Compute F1 score from precision and recall */
export function f1Score(precision: number, recall: number): number {
  if (precision + recall === 0) return 0
  return (2 * precision * recall) / (precision + recall)
}

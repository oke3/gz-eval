// ─────────────────────────────────────────────────────
// gz-eval — A/B Comparison
// Compare two evaluation reports side by side
// ─────────────────────────────────────────────────────

import type { ABComparison, EvalReport } from '../core/types.js'

/** Significance threshold for winner determination */
const WINNER_THRESHOLD = 0.05

/**
 * Compare two EvalReports.
 *
 * 1. Match results by caseId
 * 2. For each metric, compute delta
 * 3. Determine winner (mean score difference > threshold)
 * 4. Statistical significance (Welch's t-test approximation)
 */
export function compareReports(reportA: EvalReport, reportB: EvalReport): ABComparison {
  // Build maps by caseId
  const mapA = new Map(reportA.results.map((r) => [r.caseId, r]))
  const mapB = new Map(reportB.results.map((r) => [r.caseId, r]))

  // Find common case IDs
  const commonIds = [...mapA.keys()].filter((id) => mapB.has(id))

  if (commonIds.length === 0) {
    return {
      nameA: reportA.name,
      nameB: reportB.name,
      reportA,
      reportB,
      winner: 'tie',
      differences: [],
    }
  }

  // Collect all metric names
  const metricNames = new Set<string>()
  for (const id of commonIds) {
    const rA = mapA.get(id)!
    const rB = mapB.get(id)!
    for (const m of rA.metrics) metricNames.add(m.name)
    for (const m of rB.metrics) metricNames.add(m.name)
  }

  // Compute per-metric differences
  const differences: ABComparison['differences'] = []
  let totalDeltaA = 0
  let totalDeltaB = 0

  for (const metricName of metricNames) {
    const scoresA: number[] = []
    const scoresB: number[] = []

    for (const id of commonIds) {
      const rA = mapA.get(id)!
      const rB = mapB.get(id)!
      const mA = rA.metrics.find((m) => m.name === metricName)
      const mB = rB.metrics.find((m) => m.name === metricName)
      scoresA.push(mA?.score ?? 0)
      scoresB.push(mB?.score ?? 0)
    }

    const meanA = scoresA.reduce((a, b) => a + b, 0) / scoresA.length
    const meanB = scoresB.reduce((a, b) => a + b, 0) / scoresB.length
    const delta = meanA - meanB

    const significant = welchTTest(scoresA, scoresB) < 0.05

    differences.push({
      metric: metricName,
      scoreA: meanA,
      scoreB: meanB,
      delta,
      significant,
    })

    totalDeltaA += meanA
    totalDeltaB += meanB
  }

  // Determine winner based on overall mean difference
  const avgDelta = totalDeltaA - totalDeltaB
  let winner: 'A' | 'B' | 'tie' = 'tie'
  if (avgDelta > WINNER_THRESHOLD) winner = 'A'
  else if (avgDelta < -WINNER_THRESHOLD) winner = 'B'

  // If no significant differences, call it a tie
  const hasSignificant = differences.some((d) => d.significant)
  if (!hasSignificant && winner !== 'tie') {
    winner = 'tie'
  }

  return {
    nameA: reportA.name,
    nameB: reportB.name,
    reportA,
    reportB,
    winner,
    differences,
  }
}

/**
 * Welch's t-test approximation.
 * Returns p-value (simplified — good enough for comparisons).
 */
function welchTTest(a: number[], b: number[]): number {
  if (a.length < 2 || b.length < 2) return 1

  const meanA = a.reduce((s, v) => s + v, 0) / a.length
  const meanB = b.reduce((s, v) => s + v, 0) / b.length

  const varA = a.reduce((s, v) => s + (v - meanA) ** 2, 0) / (a.length - 1)
  const varB = b.reduce((s, v) => s + (v - meanB) ** 2, 0) / (b.length - 1)

  const se = Math.sqrt(varA / a.length + varB / b.length)
  if (se === 0) return 1

  const t = Math.abs(meanA - meanB) / se

  // Approximate p-value using t-distribution approximation
  // For |t| > 3, p < 0.01; for |t| > 2, p < 0.05; etc.
  const df = a.length + b.length - 2
  const p = approxPValue(t, df)
  return p
}

/** Approximate p-value from t-statistic */
function approxPValue(t: number, df: number): number {
  // Simple approximation using the normal distribution
  // This is good enough for most practical purposes
  if (df <= 0) return 1
  if (t <= 0) return 1

  // Use a rough approximation: p ≈ 2 * (1 - Φ(t))
  // where Φ is the standard normal CDF
  const x = t / Math.sqrt(df)
  const p = 2 * (1 - normalCDF(x))
  return Math.min(1, Math.max(0, p))
}

/** Standard normal CDF approximation (Abramowitz and Stegun) */
function normalCDF(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x >= 0 ? 1 : -1
  const absX = Math.abs(x)

  const t = 1.0 / (1.0 + p * absX)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2)

  return 0.5 * (1.0 + sign * y)
}

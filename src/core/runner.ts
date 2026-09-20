// ─────────────────────────────────────────────────────
// gz-eval — EvalRunner
// Executes eval cases with concurrency control
// ─────────────────────────────────────────────────────

import type { EvalCase, EvalResult, MetricFn, RunnerFn, MetricResult, ProgressCallback } from './types.js'

/** Metric registry — maps metric names to implementations */
const metricRegistry = new Map<string, MetricFn>()

/** Register a metric implementation */
export function registerMetric(name: string, fn: MetricFn): void {
  metricRegistry.set(name, fn)
}

/** Look up a registered metric */
export function getMetric(name: string): MetricFn | undefined {
  return metricRegistry.get(name)
}

/** Get all registered metric names */
export function getRegisteredMetrics(): string[] {
  return [...metricRegistry.keys()]
}

/** Timeout wrapper for a promise */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (err) => { clearTimeout(timer); reject(err) }
    )
  })
}

/** Run a batch of eval cases with concurrency control */
export async function runCases(
  cases: EvalCase[],
  runner: RunnerFn,
  metricNames: string[],
  opts: {
    concurrency: number
    timeout: number
    threshold: number
    onProgress?: ProgressCallback
  }
): Promise<EvalResult[]> {
  const results: EvalResult[] = []
  const metrics = metricNames
    .map((name) => ({ name, fn: metricRegistry.get(name) }))
    .filter((m): m is { name: string; fn: MetricFn } => m.fn !== undefined)

  if (metrics.length === 0) {
    throw new Error(`No registered metrics found for: ${metricNames.join(', ')}`)
  }

  let completed = 0
  const total = cases.length

  // Process in batches of `concurrency`
  for (let i = 0; i < cases.length; i += opts.concurrency) {
    const batch = cases.slice(i, i + opts.concurrency)
    const batchResults = await Promise.all(
      batch.map(async (evalCase) => {
        const result = await runSingleCase(evalCase, runner, metrics, opts.timeout, opts.threshold)
        completed++
        opts.onProgress?.(completed, total)
        return result
      })
    )
    results.push(...batchResults)
  }

  return results
}

/** Run a single eval case */
async function runSingleCase(
  evalCase: EvalCase,
  runner: RunnerFn,
  metrics: Array<{ name: string; fn: MetricFn }>,
  timeout: number,
  threshold: number
): Promise<EvalResult> {
  const startTime = Date.now()

  try {
    // Generate answer with timeout
    const actualAnswer = await withTimeout(
      runner(evalCase.query, evalCase.context),
      timeout,
      `case ${evalCase.id}`
    )

    const latencyMs = Date.now() - startTime

    // Compute all metrics
    const metricResults: MetricResult[] = metrics.map(({ name, fn }) =>
      fn(evalCase.expectedAnswer, actualAnswer, evalCase.context, evalCase.expectedContext)
    )

    // Aggregate score (mean of all metrics)
    const aggregateScore = metricResults.reduce((sum, m) => sum + m.score, 0) / metricResults.length

    return {
      caseId: evalCase.id,
      query: evalCase.query,
      expectedAnswer: evalCase.expectedAnswer,
      actualAnswer,
      metrics: metricResults,
      latencyMs,
      passed: aggregateScore >= threshold,
    }
  } catch (err) {
    const latencyMs = Date.now() - startTime
    const errorMessage = err instanceof Error ? err.message : String(err)

    return {
      caseId: evalCase.id,
      query: evalCase.query,
      expectedAnswer: evalCase.expectedAnswer,
      actualAnswer: '',
      metrics: [],
      latencyMs,
      passed: false,
      error: errorMessage,
    }
  }
}

/** Compute summary statistics from results */
export function computeSummary(
  results: EvalResult[],
  metricNames: string[],
  totalCost: number = 0
) {
  const passedCases = results.filter((r) => r.passed).length
  const allScores = results.map((r) => {
    if (r.metrics.length === 0) return 0
    return r.metrics.reduce((sum, m) => sum + m.score, 0) / r.metrics.length
  })
  const meanScore = allScores.length > 0
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0

  // Per-metric averages
  const metricAverages: Record<string, number> = {}
  for (const name of metricNames) {
    const scores = results
      .filter((r) => !r.error)
      .map((r) => r.metrics.find((m) => m.name === name)?.score ?? 0)
    metricAverages[name] = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0
  }

  // Latency percentiles
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b)
  const p50LatencyMs = percentile(latencies, 0.50)
  const p95LatencyMs = percentile(latencies, 0.95)
  const p99LatencyMs = percentile(latencies, 0.99)

  return {
    totalCases: results.length,
    passedCases,
    passRate: results.length > 0 ? passedCases / results.length : 0,
    meanScore,
    metricAverages,
    p50LatencyMs,
    p95LatencyMs,
    p99LatencyMs,
    totalCost,
  }
}

/** Compute percentile from sorted array */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil(sorted.length * p) - 1
  return sorted[Math.max(0, idx)]
}

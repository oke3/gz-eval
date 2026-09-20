// ─────────────────────────────────────────────────────
// gz-eval — Core Types
// ─────────────────────────────────────────────────────

/** A single evaluation case — the atomic unit of testing */
export interface EvalCase {
  /** Unique identifier for this case */
  id: string
  /** The input query / prompt */
  query: string
  /** The expected correct answer */
  expectedAnswer: string
  /** Expected relevant context chunks/passages (for retrieval metrics) */
  expectedContext?: string[]
  /** Actual retrieved context (filled by runner) */
  context?: string[]
  /** Generated answer (filled by runner) */
  actualAnswer?: string
  /** Arbitrary metadata (cost, model version, etc.) */
  metadata?: Record<string, unknown>
  /** Tags for filtering: ['math', 'coding', 'reasoning'] */
  tags?: string[]
}

/** Result of a single metric computation */
export interface MetricResult {
  /** Metric name */
  name: string
  /** Normalized score 0–1 */
  score: number
  /** Optional breakdown / debugging info */
  details?: Record<string, unknown>
}

/** Result of evaluating a single case through the pipeline */
export interface EvalResult {
  caseId: string
  query: string
  expectedAnswer: string
  actualAnswer: string
  metrics: MetricResult[]
  latencyMs: number
  /** True if aggregate score >= threshold */
  passed: boolean
  /** If the case threw or timed out */
  error?: string
}

/** Full evaluation report */
export interface EvalReport {
  /** Unique run id (uuid) */
  id: string
  /** Suite name */
  name: string
  /** Unix timestamp of run completion */
  timestamp: number
  /** Per-case results */
  results: EvalResult[]
  /** Aggregate summary statistics */
  summary: EvalSummary
  /** The config used for this run */
  config: EvalConfig
}

/** Summary statistics for a report */
export interface EvalSummary {
  totalCases: number
  passedCases: number
  passRate: number
  meanScore: number
  metricAverages: Record<string, number>
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  totalCost: number
}

/** Configuration for an evaluation run */
export interface EvalConfig {
  name: string
  description?: string
  /** Which metrics to compute */
  metrics: string[]
  /** Pass/fail threshold (0–1) */
  threshold: number
  /** Max parallel eval cases */
  concurrency: number
  /** Per-case timeout in ms */
  timeout: number
  /** LLM provider config */
  provider: ProviderConfig
  /** Optional reranker config */
  reranker?: RerankerConfig
}

/** LLM provider configuration */
export interface ProviderConfig {
  name: string
  model: string
  apiKey?: string
  baseUrl?: string
}

/** Reranker configuration */
export interface RerankerConfig {
  name: string
  apiKey?: string
}

/** A/B comparison between two evaluation reports */
export interface ABComparison {
  nameA: string
  nameB: string
  reportA: EvalReport
  reportB: EvalReport
  winner: 'A' | 'B' | 'tie'
  differences: Array<{
    metric: string
    scoreA: number
    scoreB: number
    delta: number
    /** Whether the difference is statistically significant (p < 0.05) */
    significant: boolean
  }>
}

/** Function signature for a metric implementation */
export type MetricFn = (
  expectedAnswer: string,
  actualAnswer: string,
  context?: string[],
  expectedContext?: string[]
) => MetricResult

/** Callback for progress reporting */
export type ProgressCallback = (current: number, total: number) => void

/** Runner function that generates an answer for a query */
export type RunnerFn = (query: string, context?: string[]) => Promise<string>

/** Options for EvalSuite.run() */
export interface RunOptions {
  onProgress?: ProgressCallback
  runner?: RunnerFn
}

// ─────────────────────────────────────────────────────
// gz-eval — Barrel Export
// ─────────────────────────────────────────────────────

// Core
export { EvalSuite } from './core/suite.js'
export { registerMetric, getMetric, getRegisteredMetrics, runCases, computeSummary } from './core/runner.js'

// Types
export type {
  EvalCase,
  EvalConfig,
  EvalReport,
  EvalResult,
  EvalSummary,
  MetricResult,
  MetricFn,
  RunnerFn,
  RunOptions,
  ProgressCallback,
  ProviderConfig,
  RerankerConfig,
  ABComparison,
} from './core/types.js'

// Metrics
export { precisionMetric } from './metrics/precision.js'
export { recallMetric } from './metrics/recall.js'
export { faithfulnessMetric } from './metrics/faithfulness.js'
export { relevanceMetric } from './metrics/relevance.js'
export { hallucinationMetric } from './metrics/hallucination.js'

// Utilities
export { tokenize, jaccard, cosineSimilarity, f1Score } from './metrics/utils.js'

// A/B Comparison
export { compareReports } from './compare/ab.js'

// Reports
export { generateReportHtml, generateComparisonHtml, getReportBuffer, getComparisonBuffer } from './report/html.js'

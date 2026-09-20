// ─────────────────────────────────────────────────────
// gz-eval — EvalSuite
// Load, run, and report on evaluation cases
// ─────────────────────────────────────────────────────

import { readFileSync } from 'fs'
import { randomUUID } from 'crypto'
import type {
  EvalCase,
  EvalConfig,
  EvalReport,
  EvalResult,
  RunnerFn,
  RunOptions,
  ProgressCallback,
} from './types.js'
import { runCases, computeSummary, getRegisteredMetrics } from './runner.js'

/** Default LLM runner — calls the provider API */
function defaultRunner(config: EvalConfig): RunnerFn {
  return async (query: string, _context?: string[]): Promise<string> => {
    const { provider } = config
    const url = provider.baseUrl || getDefaultBaseUrl(provider.name)
    const apiKey = provider.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || ''

    if (!apiKey) {
      throw new Error(`No API key found for provider "${provider.name}". Set the provider apiKey in config or OPENAI_API_KEY/ANTHROPIC_API_KEY env var.`)
    }

    const isAnthropic = provider.name.toLowerCase().includes('anthropic')

    if (isAnthropic) {
      return callAnthropic(url, apiKey, provider.model, query)
    }
    return callOpenAI(url, apiKey, provider.model, query)
  }
}

function getDefaultBaseUrl(providerName: string): string {
  const name = providerName.toLowerCase()
  if (name.includes('anthropic')) return 'https://api.anthropic.com/v1/messages'
  return 'https://api.openai.com/v1/chat/completions'
}

async function callOpenAI(url: string, apiKey: string, model: string, query: string): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: query }],
      temperature: 0,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${body}`)
  }

  const data = await res.json() as any
  return data.choices?.[0]?.message?.content ?? ''
}

async function callAnthropic(url: string, apiKey: string, model: string, query: string): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: query }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${body}`)
  }

  const data = await res.json() as any
  return data.content?.[0]?.text ?? ''
}

/**
 * EvalSuite — the main entry point for running evaluations.
 *
 * Usage:
 * ```ts
 * const suite = new EvalSuite(config)
 * await suite.loadCases(cases)
 * const report = await suite.run({ onProgress: console.log })
 * ```
 */
export class EvalSuite {
  private config: EvalConfig
  private cases: EvalCase[] = []
  private results: EvalResult[] = []

  constructor(config: EvalConfig) {
    this.config = { ...config }
  }

  /** Load cases from an array */
  async loadCases(cases: EvalCase[]): Promise<void> {
    this.cases = [...cases]
  }

  /** Load cases from a JSON or JSONL file */
  async loadFile(path: string): Promise<void> {
    const content = readFileSync(path, 'utf-8')
    const ext = path.split('.').pop()?.toLowerCase()

    if (ext === 'jsonl') {
      this.cases = content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as EvalCase)
    } else {
      const parsed = JSON.parse(content)
      this.cases = Array.isArray(parsed) ? parsed : [parsed]
    }
  }

  /** Run all loaded cases and return a report */
  async run(options?: RunOptions): Promise<EvalReport> {
    if (this.cases.length === 0) {
      throw new Error('No cases loaded. Call loadCases() or loadFile() first.')
    }

    const runner = options?.runner || defaultRunner(this.config)

    this.results = await runCases(
      this.cases,
      runner,
      this.config.metrics,
      {
        concurrency: this.config.concurrency,
        timeout: this.config.timeout,
        threshold: this.config.threshold,
        onProgress: options?.onProgress,
      }
    )

    const summary = computeSummary(this.results, this.config.metrics)

    return {
      id: randomUUID(),
      name: this.config.name,
      timestamp: Date.now(),
      results: this.results,
      summary,
      config: { ...this.config },
    }
  }

  /** Compare this suite's results with another suite's results */
  async compare(other: EvalSuite): Promise<import('./types.js').ABComparison> {
    const { compareReports } = await import('../compare/ab.js')

    if (this.results.length === 0) {
      throw new Error('This suite has not been run yet. Call run() first.')
    }
    if (other.results.length === 0) {
      throw new Error('The other suite has not been run yet. Call run() first.')
    }

    const reportA: EvalReport = {
      id: randomUUID(),
      name: this.config.name,
      timestamp: Date.now(),
      results: this.results,
      summary: computeSummary(this.results, this.config.metrics),
      config: { ...this.config },
    }

    const reportB: EvalReport = {
      id: randomUUID(),
      name: other.config.name,
      timestamp: Date.now(),
      results: other.results,
      summary: computeSummary(other.results, other.config.metrics),
      config: { ...other.config },
    }

    return compareReports(reportA, reportB)
  }

  /** Get loaded cases */
  getCases(): EvalCase[] {
    return [...this.cases]
  }

  /** Get results (after run) */
  getResults(): EvalResult[] {
    return [...this.results]
  }

  /** Get summary (after run) */
  getSummary() {
    return computeSummary(this.results, this.config.metrics)
  }

  /** Get config */
  getConfig(): EvalConfig {
    return { ...this.config }
  }
}

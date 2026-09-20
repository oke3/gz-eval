#!/usr/bin/env node
// ─────────────────────────────────────────────────────
// gz-eval — CLI
// ─────────────────────────────────────────────────────

import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { EvalSuite } from './core/suite.js'
import { registerMetric } from './core/runner.js'
import { precisionMetric } from './metrics/precision.js'
import { recallMetric } from './metrics/recall.js'
import { faithfulnessMetric } from './metrics/faithfulness.js'
import { relevanceMetric } from './metrics/relevance.js'
import { hallucinationMetric } from './metrics/hallucination.js'
import { generateReportHtml, generateComparisonHtml } from './report/html.js'
import type { EvalConfig, EvalCase, EvalReport } from './core/types.js'

// Register all built-in metrics
registerMetric('precision', precisionMetric)
registerMetric('recall', recallMetric)
registerMetric('faithfulness', faithfulnessMetric)
registerMetric('relevance', relevanceMetric)
registerMetric('hallucination', hallucinationMetric)

const VERSION = '1.0.0'

function printUsage() {
  console.log(`
  gz-eval v${VERSION} — AI Evaluation Framework

  USAGE:
    gz-eval run <suite.json>                       Run evaluation suite
    gz-eval compare <suite-a.json> <suite-b.json>   Compare two suites
    gz-eval report <results.json>                   Generate HTML report
    gz-eval init                                    Generate example suite.json
    gz-eval metrics                                 List available metrics
    gz-eval --help                                  Show this help
    gz-eval --version                               Show version

  EXAMPLES:
    gz-eval run my-suite.json
    gz-eval run my-suite.json --output results.json
    gz-eval compare suite-a.json suite-b.json
    gz-eval report results.json --output report.html
    gz-eval init --output my-suite.json
  `)
}

function printVersion() {
  console.log(`gz-eval v${VERSION}`)
}

function printMetrics() {
  console.log('Available metrics:')
  console.log('  precision     — Precision@K (retrieval precision)')
  console.log('  recall        — Recall@K (retrieval recall)')
  console.log('  faithfulness  — Faithfulness (answer vs context alignment)')
  console.log('  relevance     — Relevance (answer addresses query)')
  console.log('  hallucination — Hallucination detection (unsupported claims)')
}

async function cmdRun(suitePath: string, outputPath?: string) {
  console.log(`Loading suite from ${suitePath}...`)

  const raw = readFileSync(suitePath, 'utf-8')
  const parsed = JSON.parse(raw)

  // Support both single config and array of configs
  const configs: EvalConfig[] = Array.isArray(parsed) ? parsed : [parsed.config || parsed]
  const cases: EvalCase[] = parsed.cases || parsed

  if (configs.length === 0 || !configs[0]) {
    console.error('Error: No valid config found in suite file.')
    process.exit(1)
  }

  const config = configs[0]
  const suite = new EvalSuite(config)

  if (Array.isArray(cases)) {
    await suite.loadCases(cases)
  } else {
    await suite.loadFile(suitePath)
  }

  console.log(`Running ${suite.getCases().length} cases with ${config.metrics.length} metrics...`)

  const report = await suite.run({
    onProgress: (current, total) => {
      const pct = Math.round((current / total) * 100)
      process.stdout.write(`\r  Progress: ${current}/${total} (${pct}%)`)
    },
  })

  console.log('\n')
  printSummary(report)

  const outPath = outputPath || suitePath.replace(/\.json$/, '-results.json')
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`\nResults saved to ${outPath}`)

  // Also generate HTML report
  const htmlPath = outPath.replace(/\.json$/, '.html')
  const html = generateReportHtml(report)
  writeFileSync(htmlPath, html)
  console.log(`HTML report saved to ${htmlPath}`)
}

async function cmdCompare(pathA: string, pathB: string, outputPath?: string) {
  console.log(`Loading suite A from ${pathA}...`)
  console.log(`Loading suite B from ${pathB}...`)

  const reportA: EvalReport = JSON.parse(readFileSync(pathA, 'utf-8'))
  const reportB: EvalReport = JSON.parse(readFileSync(pathB, 'utf-8'))

  const { compareReports } = await import('./compare/ab.js')
  const comparison = compareReports(reportA, reportB)

  console.log('\n── A/B Comparison ──')
  console.log(`  A: ${comparison.nameA} (mean: ${Math.round(reportA.summary.meanScore * 100)}%)`)
  console.log(`  B: ${comparison.nameB} (mean: ${Math.round(reportB.summary.meanScore * 100)}%)`)
  console.log(`  Winner: ${comparison.winner === 'tie' ? 'No clear winner' : comparison.winner}`)

  for (const d of comparison.differences) {
    const sig = d.significant ? ' *' : ''
    console.log(`    ${d.metric}: ${(d.scoreA * 100).toFixed(1)}% vs ${(d.scoreB * 100).toFixed(1)}% (Δ${(d.delta * 100).toFixed(1)}%)${sig}`)
  }

  const outPath = outputPath || `comparison-${comparison.nameA}-vs-${comparison.nameB}.json`
  writeFileSync(outPath, JSON.stringify(comparison, null, 2))
  console.log(`\nComparison saved to ${outPath}`)

  const htmlPath = outPath.replace(/\.json$/, '.html')
  const html = generateComparisonHtml(comparison)
  writeFileSync(htmlPath, html)
  console.log(`HTML comparison saved to ${htmlPath}`)
}

async function cmdReport(resultsPath: string, outputPath?: string) {
  console.log(`Loading results from ${resultsPath}...`)
  const report: EvalReport = JSON.parse(readFileSync(resultsPath, 'utf-8'))

  const html = generateReportHtml(report)
  const outPath = outputPath || resultsPath.replace(/\.json$/, '.html')
  writeFileSync(outPath, html)
  console.log(`HTML report saved to ${outPath}`)
}

function cmdInit(outputPath?: string) {
  const exampleSuite = {
    config: {
      name: 'My Eval Suite',
      description: 'Example evaluation suite',
      metrics: ['precision', 'recall', 'faithfulness', 'relevance', 'hallucination'],
      threshold: 0.7,
      concurrency: 5,
      timeout: 30000,
      provider: {
        name: 'openai',
        model: 'gpt-4o-mini',
      },
    },
    cases: [
      {
        id: 'example-1',
        query: 'What is the capital of France?',
        expectedAnswer: 'The capital of France is Paris.',
        expectedContext: ['Paris is the capital city of France.'],
        tags: ['geography', 'factual'],
      },
      {
        id: 'example-2',
        query: 'Explain what a neural network is.',
        expectedAnswer: 'A neural network is a computing system inspired by biological neural networks. It consists of layers of interconnected nodes that process information.',
        expectedContext: [
          'Neural networks are computing systems inspired by biological neural networks.',
          'They consist of layers of interconnected nodes called neurons.',
        ],
        tags: ['ml', 'explanation'],
      },
    ],
  }

  const outPath = outputPath || 'suite.json'
  writeFileSync(outPath, JSON.stringify(exampleSuite, null, 2))
  console.log(`Example suite written to ${outPath}`)
}

function printSummary(report: EvalReport) {
  const { summary } = report
  console.log('── Results ──')
  console.log(`  Total cases:  ${summary.totalCases}`)
  console.log(`  Passed:       ${summary.passedCases} (${Math.round(summary.passRate * 100)}%)`)
  console.log(`  Mean score:   ${Math.round(summary.meanScore * 100)}%`)
  console.log(`  P50 latency:  ${summary.p50LatencyMs}ms`)
  console.log(`  P95 latency:  ${summary.p95LatencyMs}ms`)
  console.log(`  P99 latency:  ${summary.p99LatencyMs}ms`)

  console.log('\n  Metric Averages:')
  for (const [name, avg] of Object.entries(summary.metricAverages)) {
    console.log(`    ${name}: ${Math.round(avg * 100)}%`)
  }
}

// ── Parse args ──
const args = process.argv.slice(2)
const command = args[0]

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  if (idx === -1) return undefined
  return args[idx + 1]
}

async function main() {
  switch (command) {
    case 'run':
      if (!args[1]) { console.error('Error: suite path required.'); process.exit(1) }
      await cmdRun(args[1], getFlag('output'))
      break
    case 'compare':
      if (!args[1] || !args[2]) { console.error('Error: two suite paths required.'); process.exit(1) }
      await cmdCompare(args[1], args[2], getFlag('output'))
      break
    case 'report':
      if (!args[1]) { console.error('Error: results path required.'); process.exit(1) }
      await cmdReport(args[1], getFlag('output'))
      break
    case 'init':
      await cmdInit(getFlag('output'))
      break
    case 'metrics':
      printMetrics()
      break
    case '--help':
    case '-h':
    case undefined:
      printUsage()
      break
    case '--version':
    case '-v':
      printVersion()
      break
    default:
      console.error(`Unknown command: ${command}`)
      printUsage()
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

// ─────────────────────────────────────────────────────
// gz-eval — Suite Tests
// ─────────────────────────────────────────────────────

import { describe, test, expect } from 'bun:test'
import { writeFileSync, unlinkSync } from 'fs'
import { EvalSuite } from '../src/core/suite.js'
import { registerMetric } from '../src/core/runner.js'
import { precisionMetric } from '../src/metrics/precision.js'
import { recallMetric } from '../src/metrics/recall.js'
import { relevanceMetric } from '../src/metrics/relevance.js'
import type { EvalCase, EvalConfig, RunnerFn } from '../src/core/types.js'

// Register metrics
registerMetric('precision', precisionMetric)
registerMetric('recall', recallMetric)
registerMetric('relevance', relevanceMetric)

const testConfig: EvalConfig = {
  name: 'Test Suite',
  description: 'A test evaluation suite',
  metrics: ['precision', 'recall', 'relevance'],
  threshold: 0.5,
  concurrency: 2,
  timeout: 5000,
  provider: { name: 'test', model: 'test-model' },
}

const testCases: EvalCase[] = [
  {
    id: 'case-1',
    query: 'What is 2+2?',
    expectedAnswer: '4',
    expectedContext: ['2+2 equals 4'],
    tags: ['math'],
  },
  {
    id: 'case-2',
    query: 'What is the capital of France?',
    expectedAnswer: 'Paris',
    expectedContext: ['Paris is the capital of France'],
    tags: ['geography'],
  },
  {
    id: 'case-3',
    query: 'Explain gravity.',
    expectedAnswer: 'Gravity is a force that attracts objects toward each other.',
    expectedContext: ['Gravity is a natural force of attraction between objects with mass.'],
    tags: ['physics'],
  },
]

/** Simple mock runner that echoes a canned response */
function mockRunner(responses: Record<string, string>): RunnerFn {
  return async (query: string) => {
    return responses[query] || 'I do not know'
  }
}

describe('EvalSuite', () => {
  test('load cases from array', async () => {
    const suite = new EvalSuite(testConfig)
    await suite.loadCases(testCases)
    expect(suite.getCases().length).toBe(3)
  })

  test('load cases from JSON file', async () => {
    const tmpPath = '/tmp/gz-eval-test-suite.json'
    writeFileSync(tmpPath, JSON.stringify(testCases))

    const suite = new EvalSuite(testConfig)
    await suite.loadFile(tmpPath)
    expect(suite.getCases().length).toBe(3)

    unlinkSync(tmpPath)
  })

  test('load cases from JSONL file', async () => {
    const tmpPath = '/tmp/gz-eval-test-suite.jsonl'
    const lines = testCases.map((c) => JSON.stringify(c)).join('\n')
    writeFileSync(tmpPath, lines)

    const suite = new EvalSuite(testConfig)
    await suite.loadFile(tmpPath)
    expect(suite.getCases().length).toBe(3)

    unlinkSync(tmpPath)
  })

  test('run with mock runner produces report', async () => {
    const runner = mockRunner({
      'What is 2+2?': '4',
      'What is the capital of France?': 'Paris',
      'Explain gravity.': 'Gravity is a force that attracts objects toward each other.',
    })

    const suite = new EvalSuite(testConfig)
    await suite.loadCases(testCases)

    const report = await suite.run({ runner })

    expect(report.id).toBeTruthy()
    expect(report.name).toBe('Test Suite')
    expect(report.results.length).toBe(3)
    expect(report.summary.totalCases).toBe(3)
    expect(report.summary.passRate).toBeGreaterThanOrEqual(0)
    expect(report.summary.passRate).toBeLessThanOrEqual(1)
    expect(report.summary.metricAverages).toHaveProperty('precision')
    expect(report.summary.metricAverages).toHaveProperty('recall')
    expect(report.summary.metricAverages).toHaveProperty('relevance')
  })

  test('run reports progress', async () => {
    const runner = mockRunner({ 'Q1': 'A1', 'Q2': 'A2' })
    const cases: EvalCase[] = [
      { id: '1', query: 'Q1', expectedAnswer: 'A1' },
      { id: '2', query: 'Q2', expectedAnswer: 'A2' },
    ]

    const suite = new EvalSuite(testConfig)
    await suite.loadCases(cases)

    const progressUpdates: Array<[number, number]> = []
    await suite.run({
      runner,
      onProgress: (current, total) => progressUpdates.push([current, total]),
    })

    expect(progressUpdates.length).toBe(2)
    expect(progressUpdates[0]).toEqual([1, 2])
    expect(progressUpdates[1]).toEqual([2, 2])
  })

  test('getSummary returns stats', async () => {
    const runner = mockRunner({ 'Q': 'A' })
    const suite = new EvalSuite(testConfig)
    await suite.loadCases([{ id: '1', query: 'Q', expectedAnswer: 'A' }])
    await suite.run({ runner })

    const summary = suite.getSummary()
    expect(summary.totalCases).toBe(1)
    expect(summary.meanScore).toBeGreaterThanOrEqual(0)
    expect(summary.meanScore).toBeLessThanOrEqual(1)
  })

  test('getConfig returns config', () => {
    const suite = new EvalSuite(testConfig)
    const config = suite.getConfig()
    expect(config.name).toBe('Test Suite')
    expect(config.metrics).toEqual(['precision', 'recall', 'relevance'])
  })

  test('run without cases throws', async () => {
    const suite = new EvalSuite(testConfig)
    await expect(suite.run()).rejects.toThrow('No cases loaded')
  })

  test('compare two suites', async () => {
    const runnerA = mockRunner({
      'What is 2+2?': '4',
      'What is the capital of France?': 'Paris',
    })
    const runnerB = mockRunner({
      'What is 2+2?': 'Four',
      'What is the capital of France?': 'Paris, France',
    })

    const cases: EvalCase[] = [
      { id: '1', query: 'What is 2+2?', expectedAnswer: '4' },
      { id: '2', query: 'What is the capital of France?', expectedAnswer: 'Paris' },
    ]

    const suiteA = new EvalSuite({ ...testConfig, name: 'Suite A' })
    const suiteB = new EvalSuite({ ...testConfig, name: 'Suite B' })

    await suiteA.loadCases(cases)
    await suiteB.loadCases(cases)

    await suiteA.run({ runner: runnerA })
    await suiteB.run({ runner: runnerB })

    const comparison = await suiteA.compare(suiteB)
    expect(comparison.nameA).toBe('Suite A')
    expect(comparison.nameB).toBe('Suite B')
    expect(['A', 'B', 'tie']).toContain(comparison.winner)
    expect(comparison.differences.length).toBeGreaterThan(0)
  })

  test('error case handling', async () => {
    const errorRunner: RunnerFn = async () => {
      throw new Error('API error')
    }

    const suite = new EvalSuite(testConfig)
    await suite.loadCases([
      { id: 'fail-1', query: 'Q', expectedAnswer: 'A' },
    ])

    const report = await suite.run({ runner: errorRunner })
    expect(report.results.length).toBe(1)
    expect(report.results[0].error).toContain('API error')
    expect(report.results[0].passed).toBe(false)
  })
})

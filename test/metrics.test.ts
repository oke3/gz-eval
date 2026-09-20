// ─────────────────────────────────────────────────────
// gz-eval — Metric Tests
// ─────────────────────────────────────────────────────

import { describe, test, expect } from 'bun:test'
import { precisionMetric } from '../src/metrics/precision.js'
import { recallMetric } from '../src/metrics/recall.js'
import { faithfulnessMetric } from '../src/metrics/faithfulness.js'
import { relevanceMetric } from '../src/metrics/relevance.js'
import { hallucinationMetric } from '../src/metrics/hallucination.js'
import { tokenize, jaccard, cosineSimilarity, f1Score } from '../src/metrics/utils.js'

// ── Utility Tests ──

describe('utils', () => {
  test('tokenize splits and lowercases', () => {
    expect(tokenize('Hello World!')).toEqual(['hello', 'world'])
    expect(tokenize('AI is great.')).toEqual(['ai', 'is', 'great'])
    expect(tokenize('')).toEqual([])
  })

  test('jaccard similarity', () => {
    expect(jaccard(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1)
    expect(jaccard(['a', 'b'], ['c', 'd'])).toBe(0)
    expect(jaccard(['a', 'b', 'c'], ['b', 'c', 'd'])).toBeCloseTo(0.5)
    expect(jaccard([], [])).toBe(1)
  })

  test('cosine similarity', () => {
    const a = new Map([['hello', 2], ['world', 1]])
    const b = new Map([['hello', 2], ['world', 1]])
    expect(cosineSimilarity(a, b)).toBeCloseTo(1)

    const c = new Map([['foo', 1], ['bar', 1]])
    expect(cosineSimilarity(a, c)).toBe(0)

    expect(cosineSimilarity(new Map(), new Map())).toBe(0)
  })

  test('f1Score', () => {
    expect(f1Score(1, 1)).toBe(1)
    expect(f1Score(0, 0)).toBe(0)
    expect(f1Score(0.8, 0.8)).toBeCloseTo(0.8)
  })
})

// ── Precision Tests ──

describe('precisionMetric', () => {
  test('perfect context match', () => {
    const result = precisionMetric(
      'Paris',
      'Paris',
      ['Paris is the capital of France'],
      ['Paris is the capital of France']
    )
    expect(result.name).toBe('precision')
    expect(result.score).toBe(1)
  })

  test('no overlap in context', () => {
    const result = precisionMetric(
      'alpha bravo charlie',
      'delta echo foxtrot',
      ['golf hotel india'],
      ['juliet kilo lima']
    )
    expect(result.score).toBe(0)
  })

  test('partial overlap', () => {
    const result = precisionMetric(
      'capital of France',
      'capital of France',
      ['capital France Paris city'],
      ['Paris capital France']
    )
    expect(result.score).toBeGreaterThan(0.3)
    expect(result.score).toBeLessThanOrEqual(1)
  })

  test('fallback to answer jaccard when no context', () => {
    const result = precisionMetric(
      'The answer is 42',
      'The answer is 42',
    )
    expect(result.score).toBe(1)
  })
})

// ── Recall Tests ──

describe('recallMetric', () => {
  test('perfect recall', () => {
    const result = recallMetric(
      'Paris',
      'Paris',
      ['Paris', 'France'],
      ['Paris', 'France']
    )
    expect(result.name).toBe('recall')
    expect(result.score).toBe(1)
  })

  test('partial recall', () => {
    const result = recallMetric(
      'Paris France Europe',
      'Paris France Europe',
      ['Paris'],
      ['Paris', 'France', 'Europe']
    )
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(1)
  })

  test('zero recall', () => {
    const result = recallMetric(
      'Paris',
      'Paris',
      ['completely unrelated'],
      ['Paris']
    )
    expect(result.score).toBe(0)
  })
})

// ── Faithfulness Tests ──

describe('faithfulnessMetric', () => {
  test('fully supported answer', () => {
    const result = faithfulnessMetric(
      'What is 2+2?',
      'Paris is the capital of France. France is in Europe.',
      ['Paris is the capital of France.', 'France is located in Europe.']
    )
    expect(result.name).toBe('faithfulness')
    expect(result.score).toBeGreaterThan(0.5)
  })

  test('unsupported answer', () => {
    const result = faithfulnessMetric(
      'What is 2+2?',
      'Quantum computing will solve all problems. Dragons are real.',
      ['Paris is the capital of France.']
    )
    expect(result.score).toBeLessThan(1)
  })

  test('no context returns neutral', () => {
    const result = faithfulnessMetric(
      'What?',
      'Some answer.',
    )
    expect(result.score).toBe(0.5)
  })

  test('empty answer', () => {
    const result = faithfulnessMetric(
      'What?',
      '',
      ['some context']
    )
    expect(result.score).toBe(0)
  })
})

// ── Relevance Tests ──

describe('relevanceMetric', () => {
  test('fully relevant answer', () => {
    const result = relevanceMetric(
      'capital of France',
      'Paris is the capital of France.'
    )
    expect(result.name).toBe('relevance')
    expect(result.score).toBeGreaterThan(0.5)
  })

  test('irrelevant answer', () => {
    const result = relevanceMetric(
      'capital of France',
      'The quick brown fox jumps over the lazy dog.'
    )
    expect(result.score).toBeLessThan(0.5)
  })

  test('empty answer', () => {
    const result = relevanceMetric(
      'capital of France',
      ''
    )
    expect(result.score).toBe(0)
  })
})

// ── Hallucination Tests ──

describe('hallucinationMetric', () => {
  test('no hallucinations', () => {
    const result = hallucinationMetric(
      'What?',
      'Paris is the capital of France. France is in Europe.',
      ['Paris is the capital of France.', 'France is in Europe.']
    )
    expect(result.name).toBe('hallucination')
    expect(result.score).toBeGreaterThan(0.5)
  })

  test('with hallucinations', () => {
    const result = hallucinationMetric(
      'What?',
      'Paris is the capital. Dragons breathe fire. Unicorns exist.',
      ['Paris is the capital of France.']
    )
    expect(result.score).toBeLessThan(1)
  })

  test('no context returns neutral', () => {
    const result = hallucinationMetric(
      'What?',
      'Some answer.',
    )
    expect(result.score).toBe(0.5)
  })

  test('empty answer', () => {
    const result = hallucinationMetric(
      'What?',
      '',
      ['context']
    )
    expect(result.score).toBe(1)
  })
})

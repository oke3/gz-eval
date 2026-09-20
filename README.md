# gz-eval

```
 ██████╗ ███████╗████████╗██████╗  ██████╗
██╔════╝ ██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗
██║  ███╗█████╗     ██║   ██████╔╝██║   ██║
██║   ██║██╔══╝     ██║   ██╔══██╗██║   ██║
╚██████╔╝███████╗   ██║   ██║  ██║╚██████╔╝
 ╚═════╝ ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝
```

**Production-grade evaluation framework for AI systems**

> Golden test sets, quality metrics, A/B comparison, regression detection.
> **How do you know your AI works?**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-runtime-orange.svg)](https://bun.sh/)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://github.com/oke3/gz-eval)

---

## Why gz-eval?

Building AI systems is easy. **Knowing they work** is hard.

Most teams ship AI features with a vague sense of "it seems good enough." Then users hit edge cases, hallucinations creep in, and quality degrades silently across model updates.

**gz-eval** gives you a systematic, reproducible way to measure AI quality:

- **Golden test sets** — define what "good" looks like with curated cases
- **5 built-in metrics** — precision, recall, faithfulness, relevance, hallucination detection
- **A/B comparison** — statistically compare two models or configurations
- **HTML dashboards** — visual reports you can share with your team
- **Regression detection** — catch quality drops before users do
- **CLI-first** — works in CI/CD pipelines, local dev, or as a library

If you're building RAG pipelines, chatbots, or any AI-powered feature and you need to **prove it works**, this is your tool.

---

## Quick Start

```bash
# Install
bun add gz-eval

# Or use directly
npx gz-eval init
npx gz-eval run suite.json
npx gz-eval report suite-results.json
```

### As a library

```typescript
import { EvalSuite, registerMetric } from 'gz-eval'

const config = {
  name: 'My RAG Pipeline',
  metrics: ['precision', 'recall', 'faithfulness', 'relevance', 'hallucination'],
  threshold: 0.7,
  concurrency: 10,
  timeout: 30000,
  provider: { name: 'openai', model: 'gpt-4o-mini' },
}

const cases = [
  {
    id: 'rag-1',
    query: 'What is the return policy?',
    expectedAnswer: 'You can return items within 30 days.',
    expectedContext: ['Our return policy allows returns within 30 days of purchase.'],
    tags: ['support', 'returns'],
  },
]

const suite = new EvalSuite(config)
await suite.loadCases(cases)

const report = await suite.run({
  onProgress: (current, total) => console.log(`${current}/${total}`),
})

console.log(`Pass rate: ${(report.summary.passRate * 100).toFixed(1)}%`)
```

### Custom runner

By default, gz-eval calls OpenAI/Anthropic APIs. Bring your own runner:

```typescript
const report = await suite.run({
  runner: async (query, context) => {
    // Your pipeline: retrieval → generation → answer
    const docs = await retrieveFromVectorDB(query)
    const answer = await callMyLLM(query, docs)
    return answer
  },
})
```

---

## Architecture

```
gz-eval/
├── src/
│   ├── core/
│   │   ├── types.ts        All types (EvalCase, Metric, Report, etc.)
│   │   ├── suite.ts        EvalSuite — load, run, report
│   │   └── runner.ts       EvalRunner — execute cases with concurrency
│   ├── metrics/
│   │   ├── precision.ts    Precision@K — fraction of retrieved items that are relevant
│   │   ├── recall.ts       Recall@K — fraction of expected items that were retrieved
│   │   ├── faithfulness.ts Faithfulness — does the answer align with context?
│   │   ├── relevance.ts    Relevance — does the answer address the query?
│   │   ├── hallucination.ts Hallucination detection — unsupported claims
│   │   └── utils.ts        Shared helpers (tokenization, similarity)
│   ├── compare/
│   │   └── ab.ts           A/B comparison with statistical significance
│   ├── report/
│   │   └── html.ts         Self-contained HTML dashboard generator
│   ├── cli.ts              CLI entry point
│   └── index.ts            Barrel export
├── test/
│   ├── metrics.test.ts     Metric unit tests
│   └── suite.test.ts       Suite integration tests
```

### Data Flow

```
EvalCase[] → EvalRunner → LLM Provider → EvalResult[] → Metrics → EvalReport
                                                    ↓
                                              HTML Dashboard
                                                    ↓
                                              A/B Comparison
```

---

## Features

### 5 Built-in Metrics

| Metric | What it measures | Score 1.0 means |
|--------|-----------------|-----------------|
| **Precision@K** | Retrieval accuracy | All retrieved items are relevant |
| **Recall@K** | Retrieval coverage | All relevant items were retrieved |
| **Faithfulness** | Answer grounding | Every claim is supported by context |
| **Relevance** | Query alignment | Answer fully addresses the question |
| **Hallucination** | Unsupported claims | No fabricated information detected |

### A/B Comparison

Compare two evaluation runs side by side:

```bash
npx gz-eval compare baseline.json experiment.json
```

Output includes:
- Per-metric deltas with statistical significance (Welch's t-test)
- Winner determination (threshold: 5% mean score difference)
- Side-by-side HTML comparison dashboard

### HTML Reports

Self-contained HTML files with:
- Summary cards (total cases, pass rate, mean score, latency percentiles)
- Metric breakdown bar charts
- Per-case results table with pass/fail indicators
- Dark theme, responsive layout
- No external dependencies — all CSS inline

### Concurrency Control

Run N cases in parallel while respecting rate limits:

```typescript
const config = {
  concurrency: 10,  // 10 parallel requests
  timeout: 30000,   // 30s per case
}
```

### Custom Metrics

Register your own metrics:

```typescript
import { registerMetric } from 'gz-eval'

registerMetric('my-custom-metric', (expected, actual, context, expectedContext) => {
  // Your scoring logic
  const score = computeScore(expected, actual)
  return {
    name: 'my-custom-metric',
    score,
    details: { /* debugging info */ },
  }
})
```

---

## CLI Reference

```bash
gz-eval run <suite.json>                         Run evaluation suite
gz-eval compare <suite-a.json> <suite-b.json>     Compare two suites
gz-eval report <results.json>                     Generate HTML report
gz-eval init                                      Generate example suite.json
gz-eval metrics                                   List available metrics
```

### `gz-eval run`

Run all cases in a suite and produce results + HTML report.

```bash
gz-eval run my-suite.json
gz-eval run my-suite.json --output results.json
```

### `gz-eval compare`

Compare two result files and generate a comparison report.

```bash
gz-eval compare baseline.json experiment.json
gz-eval compare baseline.json experiment.json --output comparison.json
```

### `gz-eval report`

Generate an HTML report from existing results.

```bash
gz-eval report results.json
gz-eval report results.json --output dashboard.html
```

### `gz-eval init`

Generate a starter suite.json with example cases.

```bash
gz-eval init
gz-eval init --output my-suite.json
```

---

## Metrics Reference

### Precision@K

**Formula:** `|relevant ∩ retrieved| / |retrieved|`

Measures what fraction of retrieved items are actually relevant. High precision means your retrieval isn't returning junk.

**Use for:** RAG pipeline retrieval quality, search relevance.

### Recall@K

**Formula:** `|relevant ∩ retrieved| / |relevant|`

Measures what fraction of relevant items were actually retrieved. High recall means you're not missing important context.

**Use for:** RAG pipeline completeness, knowledge base coverage.

### Faithfulness

**Algorithm:**
1. Split answer into sentences (claims)
2. For each claim, measure support from context (cosine similarity + token overlap)
3. Score = supported_claims / total_claims

Checks whether the generated answer is actually grounded in the provided context. A faithful answer doesn't introduce information beyond what's in the context.

**Use for:** RAG answer quality, citation accuracy.

### Relevance

**Algorithm:**
1. Extract key terms from query (remove stopwords)
2. Count how many appear in the answer
3. Score = matching_terms / query_terms

Checks whether the answer actually addresses the question being asked.

**Use for:** Chatbot response quality, search result relevance.

### Hallucination Detection

**Algorithm:**
1. Split answer into sentences
2. For each sentence, check if it's supported by context
3. Score = 1 - (unsupported_sentences / total_sentences)

Detects fabricated information — claims that aren't backed by the context.

**Use for:** Factual accuracy, compliance-sensitive applications.

---

## Suite File Format

```json
{
  "config": {
    "name": "My Eval Suite",
    "description": "Testing RAG pipeline quality",
    "metrics": ["precision", "recall", "faithfulness", "relevance", "hallucination"],
    "threshold": 0.7,
    "concurrency": 5,
    "timeout": 30000,
    "provider": {
      "name": "openai",
      "model": "gpt-4o-mini"
    }
  },
  "cases": [
    {
      "id": "case-1",
      "query": "What is the return policy?",
      "expectedAnswer": "Items can be returned within 30 days.",
      "expectedContext": ["Our return policy allows returns within 30 days of purchase."],
      "tags": ["support", "returns"]
    }
  ]
}
```

### Configuration Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | required | Suite name |
| `description` | string | optional | Suite description |
| `metrics` | string[] | required | Metrics to compute |
| `threshold` | number | 0.7 | Pass/fail threshold (0-1) |
| `concurrency` | number | 5 | Parallel case execution |
| `timeout` | number | 30000 | Per-case timeout (ms) |
| `provider.name` | string | required | LLM provider |
| `provider.model` | string | required | Model identifier |
| `provider.apiKey` | string | env | API key (falls back to env vars) |
| `provider.baseUrl` | string | auto | API endpoint |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key (fallback) |
| `ANTHROPIC_API_KEY` | Anthropic API key (fallback) |

---

## Related Projects

| Project | Description |
|---------|-------------|
| [gz-context-engine](https://github.com/oke3/gz-context-engine) | RAG context assembly and retrieval |
| [gz-gateway](https://github.com/oke3/gz-gateway) | AI gateway with routing, caching, rate limiting |
| [gz-agent](https://github.com/oke3/gz-agent) | Autonomous AI agent framework |
| [gz-modelrouter](https://github.com/oke3/gz-modelrouter) | Smart model routing across providers |
| [gz-bench](https://github.com/oke3/gz-bench) | LLM performance benchmarking |
| [gz-codeforge](https://github.com/oke3/gz-codeforge) | AI-powered code generation pipeline |
| [gz-sessions](https://github.com/oke3/gz-sessions) | Session management for AI applications |

---

## Enterprise Support

Ground Zero LLC offers consulting for AI evaluation pipelines:

- Custom metric development (domain-specific scoring)
- Evaluation infrastructure setup and CI/CD integration
- A/B testing frameworks for model selection
- Quality monitoring dashboards
- Regression detection and alerting

**Contact:** [groundzero.llc](https://groundzero.llc)

---

## License

MIT © Ground Zero LLC

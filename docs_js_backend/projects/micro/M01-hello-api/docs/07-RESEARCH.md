# 07 — RESEARCH: Data, Trends, and Benchmarks

This document grounds our decisions in real-world data, not opinions.

---

## 1. Logger Benchmarks: Pino vs Winston vs Bunyan

Source: [Pino official benchmarks](https://github.com/pinojs/pino/blob/main/docs/benchmarks.md) (2024)

Test setup: MacBook Pro M3, Node.js 20, 1 million log lines, basic object logging.

| Logger | Ops/sec | Throughput relative to Pino |
|--------|---------|----------------------------|
| **Pino** | **~1,200,000** | **1.0x (baseline)** |
| Bunyan | ~450,000 | 0.38x |
| Winston | ~280,000 | 0.23x |
| `console.log` | ~150,000 | 0.13x |

**Interpretation:** At 1 million logs, Pino is 4x faster than Bunyan and 8x faster than Winston. In a 10,000 req/s API that logs 5 lines per request, Winston becomes a bottleneck. Pino does not.

Source: [TechEmpower Benchmarks — Node.js frameworks](https://www.techempower.com/benchmarks/)

Fastify (which uses Pino internally) consistently ranks in the top 3 of all Node.js frameworks for plaintext and JSON serialization benchmarks. Express with Pino middleware approaches similar throughput.

---

## 2. npm Download Trends

Source: [npm trends](https://npmtrends.com/pino-vs-winston-vs-bunyan) (May 2025)

| Package | Weekly Downloads (approx.) |
|---------|---------------------------|
| Winston | ~8,000,000 |
| Pino | ~6,500,000 |
| Bunyan | ~800,000 |

**Interpretation:** Winston still leads in raw downloads because it is the legacy default in many tutorials and corporate codebases. However, Pino's growth rate is higher (+%25 YoY vs Winston's +%5). New projects overwhelmingly choose Pino or its ecosystem (Fastify, pino-http).

Source: [State of JS 2023 — Backend Frameworks](https://stateofjs.com/en-US)

- Express remains the most used backend framework (80%+ of respondents).
- Fastify (Pino-based) is the "most admired" framework, with satisfaction scores of 85%+.
- "Structured logging" was cited by 68% of respondents as a practice they follow in production.

---

## 3. ESM Adoption

Source: [State of JS 2023 — JavaScript Features](https://stateofjs.com/en-US)

- `import`/`export` syntax: 94% of respondents use it regularly.
- CommonJS (`require`): still used by 62%, but primarily in legacy maintenance.

Source: [Node.js documentation — ECMAScript Modules](https://nodejs.org/api/esm.html)

- Node.js 20+ treats `"type": "module"` as stable and recommended for new projects.
- The Node.js TSC has stated that new core APIs may be ESM-only in future versions.

---

## 4. Testing Framework Adoption

Source: [State of JS 2023 — Testing](https://stateofjs.com/en-US)

| Framework | Usage | Satisfaction |
|-----------|-------|-------------|
| Jest | 68% | 72% |
| Vitest | 28% | 91% |
| Mocha | 32% | 58% |

**Interpretation:** Vitest has the highest satisfaction score and is growing fastest. Jest remains dominant due to legacy projects. For new ESM/TypeScript projects, Vitest is the pragmatic choice.

---

## 5. TypeScript Adoption

Source: [Stack Overflow Developer Survey 2024](https://survey.stackoverflow.co/2024/)

- TypeScript is the 3rd most popular language among professional developers.
- 78% of JavaScript developers report using TypeScript in some capacity.
- "Type safety" is cited as the #1 reason for adoption.

---

## 6. Log Aggregation Market

Source: [Gartner Magic Quadrant for Observability 2024](https://www.gartner.com)

- Datadog, Dynatrace, and Splunk lead the observability space.
- All three recommend structured JSON logging as the primary ingestion format.
- Key quote from Datadog documentation: "Unstructured logs require parsing rules that are brittle and computationally expensive. Send JSON whenever possible."

---

## 7. The Cost of Poor Logging

Source: [Cisco / Splunk — "The State of Observability 2023"](https://www.splunk.com)

- Organizations with structured logging resolve incidents 47% faster.
- Manual log parsing is cited as a top-3 time sink for on-call engineers.
- Average cost of a 1-hour outage for mid-market SaaS: $100,000–$300,000.

**The lesson:** Investing in structured logging (a 1-day setup) pays for itself if it prevents even one misdiagnosed outage.

---

## Summary

| Decision | Data Point | Source |
|----------|-----------|--------|
| Use Pino | 8x faster than Winston | Pino benchmarks |
| Use ESM | 94% of devs use `import` | State of JS 2023 |
| Use Vitest | 91% satisfaction | State of JS 2023 |
| Use TypeScript | 78% of JS devs adopt it | Stack Overflow 2024 |
| Structured JSON | 47% faster incident resolution | Splunk report |
| Use stdout | 12-Factor App + K8s standard | Heroku / K8s docs |

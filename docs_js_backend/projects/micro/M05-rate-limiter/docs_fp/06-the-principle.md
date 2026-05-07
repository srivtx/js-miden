# M05 Rate Limiter: The Principle

## The Principle

> **Every door needs a bouncer, and the bouncer needs a memory that outlives the shift change.**

## Why This Matters

A rate limiter without shared state is not a rate limiter. It is a polite suggestion that only one server enforces.

The principle has three parts:

1. **Rate limiting must be infrastructure, not decoration.**
   If it lives in a single process's memory, it dies with that process. If it is not shared, it does not limit.

2. **Shared state requires an arbiter.**
   When multiple agents (servers, threads, workers) need to agree on a count, they need a single source of truth. Redis is that truth. A database row is that truth. A consensus protocol is that truth. But without one, there is no agreement.

3. **The bouncer must know when to let people in.**
   A 429 without `Retry-After` is a brick wall. A 429 with `Retry-After` is a door with a sign: "Back in 5 minutes." The sign reduces load, improves user experience, and prevents thundering herds.

## The One-Sentence Rule

Before shipping any public API, ask:

> "If one bad actor with a `while(true)` loop targets my most expensive endpoint, what happens?"

If the answer is "my database dies," you do not have a rate limiter. You have a hope.

## The Deeper Pattern

This principle extends beyond HTTP APIs:

- **Database connection pooling:** Limit concurrent queries so one runaway report does not starve checkout transactions.
- **Message queue consumers:** Limit processing rate so a traffic spike does not trigger a cascade of downstream failures.
- **CI/CD pipelines:** Limit concurrent builds so one team's Friday deploy does not consume all build agents.
- **LLM API usage:** Limit tokens per minute so one chatbot feature does not bankrupt the company.

In every case, the pattern is identical:
1. Identify a scarce resource.
2. Define a fair budget.
3. Enforce the budget with shared, persistent state.
4. Communicate the budget to users so they can self-regulate.

## The Final Test

Show your API to a malicious 12-year-old with a proxy list and a `for` loop. If they can ruin your weekend, your rate limiter is not ready.

> Good rate limiting does not stop every attack. It stops the attacks that should have been trivial to stop.

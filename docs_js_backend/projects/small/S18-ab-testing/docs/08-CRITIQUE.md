# 08-CRITIQUE.md

## Critical Analysis

### What This Project Does Well

1. **Teaches Deterministic Assignment**: The hash-based approach is the industry standard and correctly contrasted with `Math.random()`.
2. **Emphasizes Control Groups**: The most common A/B testing mistake in junior teams is omitting controls.
3. **Minimal Surface Area**: In-memory storage keeps focus on statistics, not infrastructure.

### What This Project Lacks

1. **No Sequential Testing**: Fixed-horizon experiments are safe but slow. Modern platforms use sequential testing to stop early when effects are large.

2. **No CUPED / Variance Reduction**: With CUPED, the same sample size yields 30-50% more power. Without it, teams run underpowered experiments.

3. **No Guardrail Metrics**: A real system tracks page load time, error rates, and revenue alongside the primary metric. This project only tracks conversions.

4. **No Stratification / Bucketing**: Hashing is good, but ensuring covariate balance (age, geography, device) requires stratified randomization.

5. **No Flicker / Masking**: In web A/B tests, users sometimes see the control flash before the treatment loads. This "flicker" biases results.

6. **No P-value Correction for Multiple Variants**: Testing A vs B vs C requires Bonferroni or False Discovery Rate correction. This project doesn't adjust alpha.

7. **No Exposure Window**: The project doesn't distinguish between "user was assigned" and "user actually saw the variant." Intent-to-treat vs per-protocol analysis matters.

### Architecture Critique

```
Current (Monolithic):
┌─────────────────────────────────────┐
│  Express + In-Memory Assignments    │
│  + In-Memory Conversions            │
└─────────────────────────────────────┘

Better (Event-Driven):
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Assignment  │────>│  Kafka /     │────>│  Flink /     │
│  Service     │     │  Event Store │     │  Stats       │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                                           ┌──────▼──────┐
                                           │  Dashboard  │
                                           │  (Real-time)│
                                           └─────────────┘
```

### Testing Gaps

- No SRM (Sample Ratio Mismatch) detection test
- No power analysis validation
- No simulation tests (run 10,000 A/A tests, verify 5% false positive rate)
- No cross-device consistency tests

### The Replication Crisis Connection

A/B testing in tech mirrors the replication crisis in psychology:
- Underpowered studies produce false positives
- P-hacking inflates reported effects
- Publication bias (only significant results are shared)

This project teaches the mechanics but not the scientific rigor. Students should also learn:
- Pre-registration of hypotheses
- Mandatory power analysis
- Reporting confidence intervals, not just p-values
- Replication studies before rollout

### The Meta-Critique

A/B testing is easy to implement and hard to do right. This codebase demonstrates:
- HOW to assign users
- HOW to track conversions
- HOW to calculate lift

But it doesn't teach:
- WHEN to run an experiment vs. when to use qualitative research
- HOW to design features worth testing
- WHAT to do when experiments conflict with user privacy
- HOW to build an experimentation culture

The code is correct. The surrounding organizational process is what determines success.

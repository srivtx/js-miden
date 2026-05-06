# 02-DECISIONS.md

## Key Design Decisions

### Decision 1: Hash-Based vs Database-Stored Assignment

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **Hash-based (SHA256)** | Stateless, instant, consistent | Can't change split easily | ✅ **CHOSEN** — Simple and correct |
| Database-stored | Flexible splits, audit trail | DB load, latency, complexity | ❌ Overkill for fundamentals |
| Cookie-based | Easy to implement | Users clear cookies, not cross-device | ❌ Inconsistent |
| Device ID | Works without login | Users have multiple devices | ❌ Partial solution |

**Rationale**: Hashing `userId + experimentName` provides deterministic assignment with zero infrastructure. This is how Google, Netflix, and Facebook do it at scale.

### Decision 2: In-Memory Storage vs Database

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **In-Memory Arrays** | Zero setup, fast | Lost on restart, not queryable | ✅ **CHOSEN** — Focus on assignment logic |
| PostgreSQL | Persistent, queryable | Schema, migrations, Docker | ❌ Distracts from statistics |
| Redis | Fast, TTL support | Another service to manage | ❌ Good but adds complexity |

**Rationale**: The core learning is assignment randomization and statistical testing. Storage is incidental.

### Decision 3: Statistical Test

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **Two-proportion z-test** | Standard, simple, fast | Assumes normal approximation | ✅ **CHOSEN** — Industry standard for conversion rates |
| Chi-squared test | Exact for categorical data | Less intuitive for confidence intervals | ❌ Mathematically equivalent but harder to explain |
| Bayesian A/B test | Direct probability interpretation | Requires priors, harder to implement | ❌ Good but more advanced |
| Permutation test | No distributional assumptions | Computationally expensive | ❌ Overkill for large samples |

**Rationale**: The z-test is what every A/B testing platform (Optimizely, VWO, Google Optimize) uses under the hood. Students should understand it.

### Decision 4: Sample Size Calculation

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **Fixed formula** | Deterministic, easy | Assumes known baseline rate | ✅ **CHOSEN** — Standard power analysis |
| Sequential testing | Stop early if significant | Complex, requires specialized methods | ❌ Advanced topic |
| Bayesian dynamic | Continuous updating | Harder to validate | ❌ Overkill |

**Rationale**: Fixed-horizon experiments with pre-calculated sample sizes are the safest approach for beginners. Sequential testing requires careful alpha spending functions.

### Decision 5: Multi-Variant vs A/B Only

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **A/B only** | Simple, standard statistical tests | Limited exploration | ✅ **CHOSEN** — Basics first |
| A/B/n (multi-variant) | Test multiple ideas | Requires Bonferroni correction | ❌ Good but adds multiplicity complexity |
| Multi-armed bandit | Adaptive traffic allocation | Biases effect estimates | ❌ Exploration vs exploitation tradeoff |

**Rationale**: A/B tests are the foundational building block. Multi-variant and bandit algorithms build on this understanding.

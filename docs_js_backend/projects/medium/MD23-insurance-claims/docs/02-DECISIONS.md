# Design Decisions

## Decision 1: Rules-Based Fraud Detection

**Rationale**: Simple, fast, explainable. Each rule contributes a score with clear justification.

**Trade-off**: Less sophisticated than ML models, but easier to maintain and audit.

## Decision 2: Workflow State Machine

**Rationale**: Explicit states (SUBMITTED, UNDER_REVIEW, APPROVED, DENIED, PAID) with valid transitions prevent invalid operations.

**Trade-off**: More code than simple status strings, but prevents logic errors.

## Decision 3: Adjuster Workload Tracking

**Rationale**: Increment/decrement workload counter on assignment ensures fair distribution.

**Trade-off**: Counter could drift if transactions fail. Could use actual count query instead.

## Decision 4: Decimal for Currency

**Rationale**: PostgreSQL `Decimal` type prevents floating point errors in financial calculations.

## Decision 5: Document Stub Model

**Rationale**: Actual file upload would require S3 integration. We store metadata and simulate upload.

## Decision 6: Payment as Separate Entity

**Rationale**: A claim may have multiple payments (partial payments, recoveries, reversals).

## Decision 7: Normalized Duplicate Detection

**Rationale**: Transform descriptions to canonical form before comparison.

**Implementation**:
- Lowercase
- Remove punctuation
- Normalize whitespace
- Expand abbreviations
- Calculate Jaccard similarity
- Threshold at 0.85 (85% similar words)

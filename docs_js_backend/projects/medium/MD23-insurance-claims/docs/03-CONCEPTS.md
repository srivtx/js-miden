# Core Concepts

## Near-Duplicate Detection

### Text Similarity Algorithms

| Algorithm | Complexity | Best For |
|-----------|-----------|----------|
| Exact Match | O(n) | Identical strings |
| Levenshtein | O(n*m) | Typo detection |
| Jaccard | O(n+m) | Word overlap |
| Cosine Similarity | O(n) | Document similarity |
| Hamming | O(n) | Fixed-length strings |

### Normalization Techniques

1. **Case folding**: Convert to lowercase
2. **Punctuation removal**: Strip non-alphanumeric
3. **Whitespace normalization**: Collapse multiple spaces
4. **Stop word removal**: Eliminate "the", "a", "is"
5. **Stemming/Lemmatization**: "running" → "run"
6. **Entity canonicalization**: "St." → "Street", "NY" → "New York"

## Insurance Domain

### Claims Workflow

```
SUBMITTED → UNDER_REVIEW → APPROVED → PAID
                    ↘ DENIED
```

### Loss Ratio

```
Loss Ratio = (Claims Paid + Adjustment Expenses) / Earned Premium
```

Target is typically 60-80%. Duplicate payouts inflate this ratio.

### Deductible vs Coverage Limit

- **Deductible**: Amount policyholder pays before insurance kicks in
- **Coverage Limit**: Maximum amount insurer will pay
- **Out-of-Pocket Maximum**: Cap on policyholder's total expenses

### Fraud Indicators (Red Flags)

- Claim filed immediately after policy inception
- Handwritten receipts
- Round number damages ($10,000 exactly)
- Recent increase in coverage
- Claimant is overly knowledgeable about insurance
- No police report for auto accident
- Witnesses are family members

## Database Patterns

### Soft Deletes
Keeping cancelled/denied claims for audit trail rather than hard deleting.

### Event Sourcing for Claims
Some systems store every state change as events:
- `ClaimSubmittedEvent`
- `AdjusterAssignedEvent`
- `ClaimApprovedEvent`
- `PaymentIssuedEvent`

This creates complete audit trail but adds complexity.

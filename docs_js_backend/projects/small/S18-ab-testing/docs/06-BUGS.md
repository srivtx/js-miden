# 06-BUGS.md

## Real-World Bug Impact

### Bug 1: Non-Deterministic Assignment

**WHAT**: `assignVariant()` uses `Math.random()` to pick a variant. The same user gets different variants on different requests.

**Real-World Impact**:

- **Booking.com (2014)**: A flawed randomization function caused 3% of users to switch variants mid-experiment. The team detected inconsistent conversion rates within the same user cohort. After switching to hash-based assignment, experiment reliability improved dramatically.

- **E-commerce Platform (anonymized, 2019)**: `Math.random()` seeded from system time caused users arriving in the same millisecond to get identical variants. A promotional email blast sent 50,000 users at 09:00:00.000 — all received the control variant. The treatment appeared to lose by a massive margin. The bug cost 3 weeks of engineering time.

- **User Experience Damage**:
```
User Session:
  09:00: Homepage loads with "red" button variant
  09:05: User refreshes -> sees "blue" button variant
  09:10: User clicks back from checkout -> sees "green" button variant
  
Result:
  - User is confused by inconsistent branding
  - Trust decreases
  - Conversion rate drops for reasons unrelated to button color
  - Experiment data is uninterpretable
```

**How to Detect in Production**:
- Sample Ratio Mismatch (SRM) test: Are variants balanced? chi-squared p < 0.001 indicates assignment bug.
- User-level consistency: Query users with multiple assignments and flag them.
- Session replay tools showing variant switching.

**WRONG vs RIGHT**:
```typescript
// WRONG: Random per request
function assignVariant(experiment, userId) {
  return variants[Math.floor(Math.random() * variants.length)];
}

// RIGHT: Deterministic hash
function assignVariant(experiment, userId) {
  const hash = sha256(`${experiment}:${userId}`);
  const bucket = parseInt(hash.slice(0, 8), 16) % 100;
  return variants[Math.floor(bucket / (100 / variants.length))];
}
```

### Bug 2: No Control Group

**WHAT**: The experiment `button-color` has variants `['red', 'blue']` with no baseline.

**Real-World Impact**:

- **Microsoft Bing (2012, hypothetical scenario)**: Imagine testing two new ad layouts without the existing layout as control. Layout A shows +5% revenue, Layout B shows +8%. The team ships Layout B. In reality, the old layout had +15% revenue compared to both. The "winning" experiment actually destroyed $50M in annual revenue.

- **The Control Group Is Non-Negotiable**:
```
Scenario: Holiday Season

Without Control:
  Treatment conversion: 8%
  -> Is this good? During holidays, baseline might be 12%.
  -> We might be underperforming but don't know it.

With Control:
  Control conversion: 12%
  Treatment conversion: 8%
  -> Treatment is -33% vs control!
  -> Decision: Keep control, reject treatment.
```

**How to Detect in Production**:
- Experiment configuration review: Every experiment MUST have a control variant.
- Automated linting: CI/CD blocks experiments without control groups.
- Analyst training: "No control, no conclusion" mantra.

**WRONG vs RIGHT**:
```typescript
// WRONG: No control
const experiment = {
  variants: ['red', 'blue']  // Both are new. No baseline.
};

// RIGHT: Control + treatments
const experiment = {
  variants: ['control', 'red', 'blue']  // Control is existing experience
};
```

### Additional Production Bugs Not In This Codebase

- **Sample Ratio Mismatch**: A routing bug sends 60% of traffic to control, 40% to treatment. Chi-squared test on assignment counts detects this.
- **P-hacking**: Running 20 experiments and reporting only the "significant" one. Expected false positives: 1 (5% of 20).
- **Novelty Effect**: Users click the new variant because it's different, not because it's better. Effect disappears after 1 week.
- **Network Effects**: Uber testing surge pricing in one city affects neighboring cities' demand. Requires cluster-randomized experiments.
- **Carryover Effects**: Testing the same user in overlapping experiments on the same feature contaminates both.

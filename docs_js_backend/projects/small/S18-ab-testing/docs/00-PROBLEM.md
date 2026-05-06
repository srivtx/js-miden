# 00-PROBLEM.md

## WHAT Problem Does A/B Testing Solve?

Product teams make decisions based on intuition, HiPPOs (Highest Paid Person's Opinion), or small focus groups. A redesign might "feel" better but actually reduce conversions by 15%. Without controlled experiments, every change is a gamble with no way to measure causal impact.

**The Core Problem**: Correlation is not causation

```
Intuition-Based Decision Making:

Week 1: Redesign checkout page (team thinks it looks cleaner)
Week 2: Revenue drops 10%
Week 3: Team argues it's "seasonality" or "marketing spend"
Week 4: No one knows if the redesign caused the drop
Week 5: Roll back? Keep it? No data supports either choice.
```

## WHY This Matters

- **Causal Inference**: Only randomized controlled experiments prove that X caused Y
- **ROI Measurement**: A $50K engineering project should show measurable lift
- **Risk Reduction**: Test on 5% of users before rolling out to 100%
- **Counterintuitive Results**: Amazon famously found that increasing latency by 100ms reduced sales by 1%
- **Culture**: Data-driven teams ship faster and argue less

## HOW A/B Testing Addresses It

Split users into two (or more) groups. Show each group a different variant. Measure the difference in outcomes.

```
A/B Testing Flow:

Traffic Split:
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   User A     │─────>│  Control     │─────>│  Conversion  │
│   (50%)      │      │  (Blue btn)  │      │  No          │
└──────────────┘      └──────────────┘      └──────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   User B     │─────>│  Treatment   │─────>│  Conversion  │
│   (50%)      │      │  (Red btn)   │      │  Yes!        │
└──────────────┘      └──────────────┘      └──────────────┘

Result: Red button has 12% higher conversion (p < 0.05)
Action: Roll out red button to 100% of users
```

But A/B testing introduces NEW problems:
1. **Non-deterministic assignment**: `Math.random()` gives the same user different variants on refresh
2. **No control group**: Without a baseline, you can't measure lift
3. **Sample ratio mismatch**: A bug sends 70% to control, 30% to treatment
4. **P-hacking**: Running 20 experiments guarantees one "significant" result by chance
5. **Novelty effect**: Users click the new button because it's new, not because it's better

## WRONG vs RIGHT

| Aspect | WRONG (Broken Experiment) | RIGHT (Valid Experiment) |
|--------|--------------------------|--------------------------|
| Assignment | `Math.random()` per request | Hash-based, deterministic |
| Groups | Two treatments, no control | Control + treatment(s) |
| Sample size | 100 users | Power analysis says 10,000 |
| Duration | 1 day | Full business cycle (1-2 weeks) |
| Metric | Clicks only | Primary + guardrail metrics |
| Analysis | Peek daily, stop when significant | Fixed horizon, pre-registered |

## Real-World Impact

- **Google (2009)**: Tested 41 shades of blue for link color. The winning shade increased revenue by $200M/year.
- **Microsoft (2012)**: Bing tested a new ad display format. A/B test showed 12% revenue increase, worth >$100M annually.
- **Netflix (2016)**: Thumbnail A/B testing increased engagement by 20% by showing the right image for each user.
- **Obama 2012 Campaign**: A/B tested donation page headlines. The winning variant raised $57M more than the default.

# 01-THINKING.md

## Design Thinking: Experiments as Science

Building an A/B testing backend requires thinking like a statistician, not just a developer.

### The Scientific Method Applied to Software

```
1. Hypothesis: "Changing the button color from blue to red will increase conversions"
2. Experiment Design: 50/50 split, 2-week duration, conversion rate as metric
3. Randomization: Hash user ID for deterministic assignment
4. Execution: Serve variants, track exposures and conversions
5. Analysis: Two-proportion z-test at alpha = 0.05
6. Decision: Reject null hypothesis? Roll out or keep control.
```

### User Assignment Thinking

The hardest problem: How do you assign a user to a variant consistently across devices and sessions?

```
WRONG: Random per request
  User visits page -> assigned "red"
  User refreshes   -> assigned "blue"
  Result: User sees both variants. Experience is broken. Data is garbage.

RIGHT: Deterministic hash
  variant = hash(userId + experimentName) % 100
  If variant < 50: "control"
  Else: "treatment"
  
  Same userId + experimentName always yields same variant.
  No database needed for assignments.
```

### The Control Group Is Sacred

Without a control, you're not running an experiment. You're just observing.

```
WRONG: Two treatments, no control
  Variant A: Red button  -> 5% conversion
  Variant B: Green button -> 6% conversion
  
  Question: Is 6% good? What was the baseline?
  Answer: Unknown. Maybe the old blue button had 10% conversion.

RIGHT: Control + treatments
  Control: Blue button -> 5% conversion
  Treatment: Red button -> 6% conversion
  
  Result: 20% lift over control (statistically significant)
  Action: Roll out red button
```

### Primary vs Guardrail Metrics

```
Primary Metric (the goal):
  - Conversion rate (user clicks button)
  
Guardrail Metrics (things that must NOT get worse):
  - Page load time
  - Bounce rate
  - Revenue per user
  - Support ticket volume
  
WRONG: "The red button increased clicks! Ship it!"
  But revenue per user dropped 30%. Users clicked more but bought less.
  
RIGHT: "The red button increased clicks AND maintained revenue. Ship it."
```

### Peeking Problem

```
WRONG: Check results daily and stop when p < 0.05
  Day 1: p = 0.12 (not significant)
  Day 2: p = 0.08 (not significant)
  Day 3: p = 0.04 (significant!) -> STOP
  
  Problem: Running multiple tests inflates false positive rate.
  Actual false positive rate after 10 peeks: ~25% (not 5%).

RIGHT: Pre-register sample size and run to completion
  Required sample size: 10,000 per variant
  Run until reached, THEN analyze once.
```

### Segmentation Thinking

An experiment might win overall but lose on mobile.

```
Overall:     +5% lift (significant)
Desktop:     +12% lift (significant)
Mobile:      -8% lift (significant)

WRONG: Roll out to everyone because overall is positive.
RIGHT: Roll out to desktop only. Investigate mobile issue separately.
```

# 01-overview.md

## WHAT

Backend service for A/B testing: assigning users to variants, tracking conversions, and calculating statistics.

## WHY

A/B testing enables data-driven decisions. Randomized controlled experiments measure the causal effect of changes.

## HOW

- Hash user ID + experiment name for deterministic assignment
- Track exposure and conversion events
- Calculate conversion rates per variant
- Use statistical tests to determine significance

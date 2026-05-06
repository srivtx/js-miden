# 04-control-group.md

## WHAT

A control group receives the existing experience to provide a baseline.

## WHY

Without a control group, you cannot distinguish the effect of the change from external factors (seasonality, trends).

## HOW

Always include a control variant:

```typescript
const variants = ['control', 'treatment-a', 'treatment-b'];
```

Compare each treatment against the control to calculate lift:

```
lift = (treatment_rate - control_rate) / control_rate
```

# Bugs & Real-World Impact

## The Flapping Bug

**Symptom**: Auto-scaling group rapidly scales up and down, sometimes every minute.

**Root Cause**: A single threshold is used for both scale-up and scale-down. When metric noise hovers around the threshold, the controller flips direction continuously.

**Code**:
```ts
if (cpu > 50) scaleUp();
else scaleDown();
```

## Real-World Incidents

### AWS Auto Scaling Flapping

AWS documentation explicitly warns about "flapping" in Auto Scaling groups. A common scenario:

> "If the target tracking metric is close to the target value, the Auto Scaling group can scale in and out repeatedly."

In 2012, a widely cited Netflix blog post described how aggressive scaling with tight thresholds caused constant instance churn, leading to:

- **Increased cost**: Paying for instances that are created and destroyed before serving traffic.
- **Cold start latency**: New instances never complete warm-up before termination.
- **Cache churn**: In-memory caches are lost on termination, increasing DB load.

### Azure VM Scale Set Oscillation

Azure VM Scale Sets with metric-based scaling rules can oscillate if the scale-out and scale-in thresholds are too close. Microsoft recommends:

> "Ensure there is a sufficient gap between scale-out and scale-in thresholds."

Failure to do so has caused production outages where:

- **Load balancer health probes** failed because backends were constantly registering/deregistering.
- **Service discovery** caches became inconsistent.
- **Database connection pools** were exhausted by startup spikes.

## Impact Summary

| Impact | Description |
|--------|-------------|
| Cost | Paying for short-lived instances and data transfer. |
| Availability | Request errors during scale transitions. |
| Latency | Cold starts never amortized. |
| Stability | Cascading failures due to cache loss. |

## Mitigation

1. **Hysteresis / Deadband**: Separate thresholds (e.g., scale out at 70%, scale in at 30%).
2. **Cooldown**: Minimum time between actions.
3. **Sustained Breach**: Require N consecutive evaluation periods above threshold.
4. **Smoothing**: Use moving averages instead of instantaneous values.

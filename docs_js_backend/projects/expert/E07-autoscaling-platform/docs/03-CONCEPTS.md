# Concepts

## Hysteresis

**WHAT**: Hysteresis means the system's output depends on its history, not just its current input. In scaling, you use two thresholds: scale up above 70%, scale down below 30%.

**WHY**: Prevents flapping when the metric hovers near a single point.

**HOW**: Maintain separate `scaleUpThreshold` and `scaleDownThreshold`. Only trigger an action when the metric exits the deadband.

**WRONG**: One threshold for both directions.
**RIGHT**: Two thresholds with a gap (deadband) between them.

## Deadband

**WHAT**: The range between the up and down thresholds where no action is taken (e.g., 30%–70%).

**WHY**: Noise and jitter in metrics would otherwise cause constant scaling.

**HOW**: `if (cpu > upThreshold) scaleUp(); else if (cpu < downThreshold) scaleDown(); else doNothing();`

**WRONG**: `if (cpu > 50) scaleUp(); else scaleDown();`
**RIGHT**: `if (cpu > 70) scaleUp(); else if (cpu < 30) scaleDown();`

## PID Controllers

**WHAT**: Proportional-Integral-Derivative controller computes a continuous control signal based on error, its integral, and its derivative.

**WHY**: Replaces bang-bang (on/off) control with smooth, proportional adjustments.

**HOW**: `u(t) = Kp * e(t) + Ki * ∫e(t)dt + Kd * de/dt`

In scaling, this translates to:
- **P**: Scale more aggressively when far from target.
- **I**: Correct persistent steady-state error (e.g., always slightly under-provisioned).
- **D**: Dampen oscillations by opposing rapid changes.

**WRONG**: Pure threshold (bang-bang) with no damping.
**RIGHT**: PID or at least PI with rate limiting.

## Cooldown

**WHAT**: A mandatory wait time between scaling actions.

**WHY**: Prevents thrashing and gives the system time to reach steady state after a change.

**HOW**: Record `lastScaleTime`. Reject new decisions until `now() - lastScaleTime > cooldownMs`.

**WRONG**: Zero cooldown with fast evaluation loop.
**RIGHT**: 30–300s cooldown depending on workload startup time.

## Oscillation Damping

**WHAT**: Techniques to reduce the amplitude of oscillations in a feedback loop.

**WHY**: Undamped oscillations waste resources and degrade availability.

**HOW**:
- Increase deadband width.
- Add derivative term (rate limiting).
- Increase cooldown.
- Use sustained-breach (require N consecutive samples above threshold).

**WRONG**: Reacting to every single metric sample.
**RIGHT**: Aggregating over a window and requiring persistence.

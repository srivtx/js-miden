# Mental Models

## The Thermostat Analogy

An auto-scaler is a thermostat for compute. You set a desired temperature (target utilization), the system senses the room temperature (current metrics), and turns the heater (new pods) or AC (termination) on or off.

In a real thermostat, hysteresis is built-in: the heater turns on at 19°C and off at 21°C. Without that deadband, the heater would chatter on and off every time the temperature drifts by 0.1°C.

## Feedback Loops

Every auto-scaler is a closed-loop control system:

1. **Sensor** → metrics endpoint.
2. **Controller** → scaling service.
3. **Actuator** → orchestrator (Kubernetes API, AWS Auto Scaling, etc.).
4. **Plant** → the workload being scaled.

The output (replica count) feeds back into the input (load per replica), creating a loop that can amplify or dampen oscillations.

## Separation of Concerns

- **Sensing**: Collect and aggregate metrics (`metricsService`).
- **Decision**: Apply rules, hysteresis, cooldown (`scalingService` / `hysteresisService`).
- **Actuation**: Change replica counts (`scalingController`).
- **Optimization**: Place workloads efficiently (`costOptimizer`).

Keeping these separate allows us to test each in isolation and swap algorithms (e.g., replace threshold logic with a PID controller).

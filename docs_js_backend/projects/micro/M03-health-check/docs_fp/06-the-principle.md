# M03 Health Check: The Principle

## The Thermometer Paradox

A thermometer does not make you healthy. It tells you if you have a fever. If you break the thermometer, you still have the fever. If you hide the thermometer, you still have the fever. If you check the thermometer every 10 seconds, you are not healing faster.

Health checks are thermometers. They measure. They do not heal. They do not prevent. They do not protect. And yet, we treat them as if they are the medicine.

## The Infrastructure Theater

A green health check dashboard creates a powerful illusion: the system is fine. But the system is never fine. It is either degrading, recovering, or failing silently. The health check samples a moment. That moment is already gone by the time you read it.

Worse, health checks become targets. Teams optimize for green dashboards, not for resilient systems. They write health checks that pass. They reduce probe sensitivity so alerts stop firing. They add retries inside health checks so transient blips are hidden. The system becomes sicker, but the thermometer reads normal.

## The Three Levels of Health Check Wisdom

### Level 1: "I check so I know."
The beginner writes `/health` to return `ok`. They check it manually after deployments. They feel good when it passes. They feel bad when it fails. They do not understand why it failed. They restart the service.

### Level 2: "I check so the orchestrator knows."
The practitioner separates liveness from readiness. They tune probe intervals and timeouts. They use health checks to automate deployments and scaling. They understand that a failing readiness probe is a signal, not a failure. They investigate before restarting.

### Level 3: "I check so I can reason about failure."
The expert uses health checks as a debugging tool. They know that a readiness failure at 3 AM is not the problem. It is the symptom. The problem happened 10 minutes earlier: a connection pool leaked, a cache node evicted a key, a deployment pushed a bad config. The health check is the breadcrumb. The expert follows the breadcrumbs backward.

## The Observability Triangle

Health checks are one vertex of a triangle:

- **Metrics** tell you that something is wrong (the fever).
- **Logs** tell you what happened (the symptoms).
- **Health checks** tell you whether the system can serve traffic (the diagnosis).

Without metrics, you do not know there is a problem until the health check fails. Without logs, you cannot diagnose why the health check failed. Without health checks, you cannot automate recovery. All three are necessary. None is sufficient.

## The Principle

> **Health checks are a control signal, not a status page.**
>
> The purpose of a health check is not to tell a human that the system is healthy. The purpose is to tell an automated system whether it should route traffic, restart a process, or trigger a failover. Every millisecond the health check takes is a millisecond of infrastructure decision-making delayed. Every dependency the health check checks is a potential false signal. Every bit of information the health check leaks is a reconnaissance gift to an attacker.
>
> Design health checks as if they are inputs to a control system — because they are.

## The Question

Before you add a health check, ask:

1. What decision will be made based on this signal?
2. What happens if the signal is false (healthy when broken, or broken when healthy)?
3. What is the blast radius of that false signal?

If a false healthy signal means customer data is lost, your health check is too shallow. If a false broken signal means a global outage, your health check is too sensitive. The health check is a dial, not a switch. Tune it with the same care you tune a PID controller. Because that is exactly what it is.

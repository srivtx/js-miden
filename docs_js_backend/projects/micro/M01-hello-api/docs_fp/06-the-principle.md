# M01 Hello API: The Principle

## Observability vs. Introspection

There is a difference between watching a system and understanding it.

**Monitoring** tells you that the patient has a fever. **Observability** lets you reconstruct why. But most logging is neither. It is noise. It is the medical equivalent of recording every heartbeat, every blink, every breath — and missing the tumor because the data is buried under a billion normal readings.

## The Signal-to-Noise Paradox

The easier it is to add a log line, the less valuable each log line becomes. When logging is free, developers log everything. When developers log everything, operators read nothing. When operators read nothing, incidents take longer to resolve. The very tool meant to reduce MTTR increases it.

This is not a technical problem. It is an incentive problem.

## The Three Levels of Logging Wisdom

### Level 1: "I log so I can debug."
The beginner adds `console.log` everywhere. The logs are a transcript of execution. They are useful once, then they become clutter. They are never removed because "what if we need them again?"

### Level 2: "I log so I can observe."
The practitioner adds structured logs with severity levels. They use correlation IDs. They sample. They aggregate. The logs are a metric source. They answer "what happened" at scale.

### Level 3: "I log so I can trust."
The expert logs only what is necessary to prove the system behaved correctly. They log the decision, not the calculation. They log the exception, not the loop iteration. They design the system so that most debugging happens in traces and metrics, not logs. The logs are a ledger of accountability, not a debugger.

## The Ledger Metaphor

Think of logs as a double-entry bookkeeping system for computer systems:

- Every state change should have a corresponding log entry.
- The sum of log entries should reconstruct the current state.
- A missing entry is a bug. A duplicate entry is a bug. An un-timestamped entry is useless.

If you cannot audit your system from its logs alone, your logs are inadequate.

## The Principle

> **Log the contract, not the implementation.**
>
> Log what the system promised and whether it kept that promise. Do not log how it kept the promise. The how belongs in traces. The whether belongs in logs. The why belongs in metrics.

A health check should not log `200 OK` every 2 seconds. It should log the moment it transitions from healthy to unhealthy, and the moment it recovers. The steady state is silent. The change is signal.

## The Question

Before you add a log line, ask:

1. Will I read this during an incident at 3 AM?
2. Will this alert fire if the pattern changes?
3. If I remove this line, what breaks?

If the answer to all three is "no," delete the line. Your future self — exhausted, paged, and desperate for signal — will thank you.

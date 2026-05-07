# The Principle: What Did Feature Flags Teach You?

## The Fundamental Truth

> **"Feature flags are deployment decoupled from release. They let you ship code that's invisible. But invisible code still runs. And running code can break."**

## The Junior Question

A junior dev says: "Feature flags let us deploy unfinished code safely."

**What's the risk?**

<br><br><br><br><br>

---

## The Answer

"Unfinished" code still:
- Executes in production
- Can have bugs
- Can affect performance
- Can introduce security vulnerabilities

**Feature flags don't make code safe. They make it hideable.**

## The Realization

Feature flags are powerful but dangerous:
- **Flag sprawl:** Hundreds of flags, nobody knows what they do
- **Dead code:** Flags that are always true/false, code never cleaned up
- **Combinatorial explosion:** 10 flags = 1024 possible combinations to test

**Use feature flags for:**
- Gradual rollouts
- A/B testing
- Emergency kill switches

**Don't use them for:**
- Hiding broken code
- Avoiding testing
- Permanent configuration

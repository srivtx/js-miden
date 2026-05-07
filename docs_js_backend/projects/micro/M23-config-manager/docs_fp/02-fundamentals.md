# Fundamentals: Config Without Files

**Task:** Load configuration with validation, no libraries.

Requirements:
- Required values must be present
- Types must be correct (PORT is a number)
- Defaults for optional values

---

## Multiple Choice: Validation

**Q:** Where should you validate config?

**A)** At runtime, when the value is used

**B)** At startup, before the server starts

**C)** In a separate config service

**D)** Both B and C

**Think before reading on.**

---

## The Answer

**D is correct.**

- **B:** Validate at startup. Fail fast if config is wrong.
- **C:** For complex systems, a config service provides central validation.
- **A:** Runtime validation is too late. The server is already running with bad config.

**Fail fast principle:** If config is wrong, crash immediately. Don't run with bad config.

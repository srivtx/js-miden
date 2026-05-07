# The Principle: What Did Config Teach You?

## The Fundamental Truth

> **"Config is code that changes without deployment. Treat it with the same rigor: validation, testing, and version control."**

## The Junior Question

A junior dev says: "I'll just use a JSON file for config. It's easy."

**What's wrong with this?**

<br><br><br><br><br>

---

## The Answer

JSON config files:
- Can't be changed without restart
- Committed to git (secrets leak)
- No validation
- No type safety

**Environment variables:**
- Standard across all platforms
- Changed without restart (with a restart)
- Not committed to git
- Can be validated at startup

## The Realization

The 12-Factor App methodology says: "Store config in environment."

This isn't a preference. It's a requirement for:
- Security (secrets not in git)
- Portability (same code, different envs)
- Scalability (easy to change across instances)

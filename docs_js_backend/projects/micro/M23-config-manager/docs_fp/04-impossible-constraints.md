# Impossible Constraint: No Environment Variables

**Task:** Configure an app without env vars, files, or network.

**Constraint:** The app must know its config at runtime, but you can't pass it in.

---

## Your Turn

How do you configure an app with no external input?

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: You Can't (Securely)

Without external input, the config must be embedded:
- **Hardcoded:** In the binary. Can't change without rebuild.
- **Compiled in:** Via build flags. Still embedded.
- **Generated at build time:** From a template. Still static.

**The point:** Configuration requires external input. The question is how to provide it securely.

**Options:**
1. **Environment variables:** Simple, standard, but limited
2. **Files:** Flexible, but need to manage distribution
3. **Network (config service):** Dynamic, but adds dependency
4. **Command-line args:** Good for one-off overrides

**This constraint forces you to realize:**

> "Zero config" apps don't exist. They just hide their config.

# The 3AM Page: The Inconsistent Experience

It's 10:00 AM. Customer support is overwhelmed.

**Support:** "Users report seeing different UIs on refresh. One moment it's the old design, next moment it's new."

You check the feature flag code:
```javascript
function isEnabled(flag, userId) {
  return Math.random() > 0.5; // 50% chance
}
```

**The same user sees A on page 1, B on page 2, A on page 3.**

Every request is independently random. Users think the app is broken.

---

## Your Turn

### Q1: Why is random assignment per-request wrong?

It's 50/50. Isn't that what A/B testing needs?

<br><br><br><br><br>

---

## The Autopsy

### Answer: Consistency matters

A user should see the SAME variant for the duration of the experiment.

**Why:**
- Page 1 shows new header (variant B)
- Page 2 shows old footer (variant A)
- CSS breaks because components expect each other

**Also:** You can't measure conversion if users switch variants mid-session.

### The Fix: Deterministic Assignment

```javascript
function isEnabled(flag, userId) {
  const hash = crypto.createHash('sha256')
    .update(`${flag}:${userId}`)
    .digest('hex');
  const bucket = parseInt(hash.slice(0, 8), 16) % 100;
  return bucket < 50; // Consistent for same user+flag
}
```

Same user + same flag = same result. Always.

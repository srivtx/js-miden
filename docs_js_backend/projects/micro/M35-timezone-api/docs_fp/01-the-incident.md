# The 3AM Page: The DST Bug

It's 3:00 AM. Users complain about wrong times.

**User:** "My flight shows 9AM arrival. It arrived at 8AM. I missed my connection."

Your timezone API:
```javascript
function convert(time, from, to) {
  const offset = OFFSETS[to]; // Fixed offset!
  return new Date(time.getTime() + offset * 3600000);
}
```

**Fixed offsets ignore DST.** Summer vs winter gives different results.

**Your API is wrong half the year.**

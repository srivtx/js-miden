# Three Wrong Ways to Handle Timezones

---

## Wrong #1: Fixed Offset Table

```javascript
const OFFSETS = {
  'NYC': -5,
  'London': 0,
  'Tokyo': 9
};
```

**Why it's wrong:** Offsets change with DST. Fixed tables are wrong half the year.

---

## Wrong #2: Client-Side Timezone

```javascript
// Client sends their local time
const localTime = req.body.time; // "2024-07-15 08:00"
```

**Why it's wrong:**
- Client timezone is unreliable (VPN, travel, wrong system settings)
- You don't know if it's EST or EDT
- Ambiguous times (1:30 AM on DST fall-back happens twice)

---

## Wrong #3: Storing Local Time

```javascript
// Store meeting time in user's local timezone
await db.meetings.create({
  time: '2024-07-15 08:00',
  timezone: 'America/New_York'
});
```

**Why it's wrong:**
- If timezone rules change, stored times become wrong
- DST transitions create ambiguous/non-existent times
- Calculations across timezones are complex

**Fix:** Store UTC. Convert to local time on display.

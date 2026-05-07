# Red Team: Timezone Attacks

---

## Attack 1: Non-Existent Time

**Payload:** Schedule meeting at 2:30 AM on DST start day.

**Impact:** Parser crashes, undefined behavior, or defaults to wrong time.

---

## Attack 2: Ambiguous Time

**Payload:** Schedule meeting at 1:30 AM on DST end day.

**Impact:** Meeting appears twice or not at all. Different users see different times.

---

## Attack 3: Extreme Year

**Payload:** Request conversion for year 10000.

**Impact:** Integer overflow, parser crash, or incorrect results.

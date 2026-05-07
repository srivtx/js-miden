# Impossible Constraint: No Timezone Database

**Task:** Handle DST transitions without any timezone data.

**Constraint:** You only know the current offset. You don't know DST rules.

---

## Your Turn

A user in New York schedules a meeting for "March 10, 2024 at 2:30 AM."

**Question:** Does this time exist? If not, why? If yes, what's the UTC equivalent?

**Write your answer:**

<br><br><br><br><br>

---

## The Reveal: It Doesn't Exist

March 10, 2024: DST starts at 2:00 AM. Clocks jump to 3:00 AM.

**2:30 AM on March 10, 2024 does not exist in America/New_York.**

Similarly, on November 3, 2024 (DST end):
- 1:30 AM happens **twice**
- Which 1:30 AM? The first (EDT, -4) or second (EST, -5)?

**Without timezone rules, you can't answer these questions.**

**The point:** Time is not a simple offset calculation. It's a political construct with edge cases that break naive math.

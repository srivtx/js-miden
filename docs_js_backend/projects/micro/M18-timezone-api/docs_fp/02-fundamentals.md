# Fundamentals: Time Without Intl API

**Task:** Convert UTC to local time using only Date methods.

**Constraint:** No `Intl.DateTimeFormat`, no timezone libraries.

---

## Multiple Choice: DST

**Q:** When does DST start in the US?

**A)** March 1

**B)** Second Sunday in March

**C)** First Sunday in April

**D)** It varies by state

**Think before reading on.**

---

## The Answer

**B is correct.**

DST rules:
- **Start:** Second Sunday in March at 2:00 AM
- **End:** First Sunday in November at 2:00 AM
- **But:** Arizona doesn't observe DST (except Navajo Nation)
- **And:** EU changed rules in 2021
- **And:** Some countries observe DST on different dates

**The point:** You can't hardcode DST rules. They change by:
- Country
- Region
- Year (politicians change them!)

**This is why timezone databases exist.** They encode the rules and are updated when politicians change their minds.

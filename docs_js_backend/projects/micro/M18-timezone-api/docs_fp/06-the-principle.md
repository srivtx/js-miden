# The Principle: What Did Timezones Teach You?

## The Fundamental Truth

> **"Time is not a number. It's a political agreement that changes based on legislation, geography, and human whims. Treating it as math is the source of all timezone bugs."**

## The Junior Question

A junior dev says: "Just store timestamps as Unix epoch. Problem solved."

**What's wrong with this?**

<br><br><br><br><br>

---

## The Answer

Unix epoch is seconds since 1970-01-01 00:00:00 UTC. It's great for:
- Sorting
- Duration calculations
- Storage

But terrible for:
- Displaying local time
- Scheduling future events
- DST transitions

**Future events stored as epoch seconds break when DST rules change.**

## The Realization

**Store:** UTC timestamp + IANA timezone name
**Display:** Convert using current timezone rules
**Never:** Store local time without timezone context
